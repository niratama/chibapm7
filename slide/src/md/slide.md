class: center, middle

# IRKitいじってみた話

Chiba.pm #7

---
class: center

## 自己紹介

![Avatar](https://pbs.twimg.com/profile_images/525202243142692865/hlqlsDjs_200x200.jpeg)

こばやし けんいち ([@Niratama](http://twitter.com/Niratama))

職場はソーシャルゲーム屋<br>
仕事はインフラ屋になりました<br>
だんだんプログラム書かない生活に<br>

---
## IRKitとは

.float-right[![IRKit](images/IRKit.jpg)]

.small[<http://getirkit.com/>]

* オープンソースの赤外線リモコンデバイス
* WiFiでスマートフォンなどから操作できる
* ハードウェアとしてはArduino互換

---
## 買ってみた

* 今年2月くらいに購入
* 実際便利
* ほとんどの機器がちゃんと学習・利用できてる
  * ウチだと蛍光灯が反応悪い以外は問題なし
* .orange[スタンバイ状態ではフルカラーLEDが青色に光っててうるさい]

---
## 改造してみよう

* 今年11月に思い立ってファームウェア改造に着手
* 先行実装がある
  * .small[<http://technology-memo.seesaa.net/article/404938528.html>]
* 直前にファームウェアのセキュリティアップデートがあったので反映されてるか確認してみた
  * セキュリティアップデートはマージ済みだった
  * でも気になる点がいくつかあった

---
## 気になる点 その1

* 消灯パッチにイマイチ感あった
    * LED消灯部分でdelayでタイミング処理してる
    * 消灯部分を別の関数呼んで実行してる

```
void wait() {
    delay( 1000 )
}
void on_ir_xmit() {
    MAINLOG_PRINTLN("i>");
    color.setLedColor( 0, 0, 1, true, 1 ); // xmit: blue blink for 1sec
    wait(); // ←ここで1秒待ってる
    on_irkit_ready(); // ←ここで消灯してる
}
```

---
## 気になる点 その2

* あちこちに消灯のコードが分散してる
  * LED点灯処理に対して直接消灯処理をつけている

---
## 自分で改造しよう

* ソースはわりとシンプルだった
* 元々LEDの処理周りがモジュール化されていた
  * LED点灯は最終的に1箇所で処理されている
  * LEDの点滅処理のためにタイマーを使っている
* これを流用すればスマートに処理できそう
  * 「LED点灯から一定時間でかならず消灯する」

---
## ソースの構成(1)

```
base64encoder.c - Base64エンコード処理
cert.h - IRKit API用の証明書
commands.h - IRKitのコマンドの定義
const.h - ファームウェアで使っている定数定義
convert.c - 16進数文字と数値の変換
CRC8.c - CRCの計算処理
env.h - 環境定義(ただしWiFiモジュール種別の定義のみ)
FullColorLed.cpp - フルカラーLEDの制御
GSwifi.cpp - WiFiモジュールの制御
HardwareSerialX.cpp - シリアルポートの制御
IrCtrl.cpp - 赤外線出力の制御
IRKit.ino - メインルーチン
```

* 今回は`FullColorLed.cpp`と`FullColorLed.h`と`IRKit.ino`だけ変更

---
## ソースの構成(2)

```
IRKitHTTPHandler.cpp - IRKitのhttpdのハンドラ
IRKitJSONParser.c - JSONパーサ
IrPacker.c - 赤外線データの圧縮・展開
Keys.cpp - セキュリティ鍵管理
log.h - ログ出力マクロ
longpressbutton.c - ボタン長押し時の処理
MemoryFree.c - メモリ解放処理
pgmStrToRAM.c - 文字列のRAMへのコピー処理
pins.h - AVRピン定義
ringbuffer.c - リングバッファ処理
timer.c - AVRタイマー処理
version.c - バージョン文字列
```

---
## 改造ポイント (1)

* LED処理にスリープタイマーを実装

---
## 改造ポイント (1)

#### FullColorLed.h

```
class FullColorLed
{
public:
    // (中略)
    void off();
    void setSleep(uint8_t sleep_timeout); // スリープ時間設定メソッドを追加
    void onTimer();
    // (中略)
private:
    // (中略)
    bool isBlinking_; // defaults to off
    volatile bool blinkOn_; // altered inside timer ISR
    volatile uint8_t blink_timer_;
    volatile uint8_t sleep_timeout_; // スリープ時間格納変数を追加
    volatile uint8_t sleep_timer_; // スリープタイマー用変数を追加
};
```

---
## 改造ポイント (1-2)

#### FullColorLed.cpp

```
FullColorLed::FullColorLed(int pinR, int pinG, int pinB) :
    pinR_(pinR),
    pinG_(pinG),
    pinB_(pinB),
    blinkOn_(0),
    isBlinking_(false),
    blink_timer_(TIMER_OFF),
    sleep_timeout_(TIMER_OFF), // スリープ時間の初期値を追加
    sleep_timer_(TIMER_OFF) // スリープタイマーの初期値を追加
{
}

// スリープ時間設定メソッドを追加
void FullColorLed::setSleep(uint8_t sleep_timeout) {
    sleep_timeout_ = sleep_timeout;
}
```

---
## 改造ポイント (2)

* LED点灯時にスリープタイマーを起動

#### FullColorLed.cpp

```
void FullColorLed::setLedColor(bool colorR, bool colorG, bool colorB, bool blink) {
    colorR_      = colorR;
    colorG_      = colorG;
    colorB_      = colorB;
    isBlinking_  = blink;

    blink_timer_ = TIMER_OFF;
    // 追加部分
    if (sleep_timeout_ != TIMER_OFF) { // スリープ時間がTIMER_OFF(=無効)でなかったら
      TIMER_START(sleep_timer_, sleep_timeout_); // スリープタイマーを起動
    }
    // 追加ここまで
}
```

---
## 改造ポイント(3)

* LED消灯時にスリープタイマーを停止

#### FullColorLed.cpp

```
void FullColorLed::off() {
    setLedColor( 0, 0, 0, false );
    TIMER_STOP(sleep_timer_); // スリープタイマーを停止
}
```

---
## 改造ポイント(4)

* タイマー処理でスリープタイマーが発火したらLEDを消灯する

```
void FullColorLed::onTimer() {
    blinkOn_ = ! blinkOn_;
    // (中略)
    TIMER_TICK(blink_timer_);
    if (TIMER_FIRED(blink_timer_)) {
        TIMER_STOP(blink_timer_);
        isBlinking_ = false;
    }
    // 追加部分
    TIMER_TICK(sleep_timer_); // スリープタイマーを進める
    if (TIMER_FIRED(sleep_timer_)) { // スリープタイマーが発火したら
      off(); // LEDを消灯する
    }
    // 追加ここまで
}
```

---
## 改造ポイント(5)

* IRKitの起動が完了した時点でスリープタイマーを3秒に設定
  * 起動処理中にはLEDが消灯しないように

```
void on_irkit_ready() {
    color.setSleep(3); // LED sleep after 3sec // LEDスリープ時間を3秒に設定
    color.setLedColor( 0, 0, 1, false ); // blue: ready
}
```

---
## デモ

* 起動→初期化→自動消灯

.center[<video controls src="images/IRKit_boot.mp4"></video>]

---
## ファームウェアの書き換え

* [公式サイトにある手順](https://github.com/irkit/device#%E3%83%95%E3%82%A1%E3%83%BC%E3%83%A0%E3%82%A6%E3%82%A7%E3%82%A2%E3%82%A2%E3%83%83%E3%83%97%E3%83%87%E3%83%BC%E3%83%88%E6%96%B9%E6%B3%95)を参照
* 書き換えに使う[Arduino IDE](https://www.arduino.cc/en/Main/Software)は[Homebrew Cask](http://caskroom.io/)にあるのでそれを使うと楽

---
## 書き換え手順

1. [Arduino IDE](https://www.arduino.cc/en/Main/Software)をインストールして起動
2. IRKitとMacをUSBケーブルで接続
3. `ツール`メニューの`マイコンボードの種類`で`Arduino Leonardo`を選択
4. `ツール`メニューの`シリアルポート`で`/dev/tty.usbmodemXXXX`を選択
5. ソースをcloneした先の`firmware/src/IRKit/`ディレクトリにある`IRKit.ino`を開く
6. `スケッチ`メニューの`マイコンボードに書き込む`で書き込み

---
## perl成分

.center[![perlのファイル](images/perlfiles.png)]

※ビルドには通常必要ありません

---
class: center

今回の資料とファイルはGitHubに置いておきます

<https://github.com/niratama/device>
<https://github.com/niratama/chibapm7>

ご自由にご利用ください
