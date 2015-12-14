/* global module, define, $ */
(function (undefined) {
  'use strict';
  var global = this,
      hasModule = (typeof module !== 'undefined' && module.exports &&
        typeof require !== 'undefined');

  var PromiseTimer = function () { this.init.apply(this, arguments); };
  PromiseTimer.prototype = {
    init: function (delay) {
      this.delay = delay;
      this.reset();
    },
    isRunning: function () {
      return this.deferred !== null || this.id !== null;
    },
    start: function (delay) {
      if (this.isRunning()) {
        return this;
      }
      if (delay === void 0) {
        delay = this.delay;
      }
      this.deferred = $.Deferred();
      var self = this;
      this.id = setTimeout(function () {
        self.deferred.resolve();
        self.reset();
      }, delay);
      return this;
    },
    cancel: function () {
      if (!this.isRunning()) {
        return;
      }
      clearTimeout(this.id);
      this.deferred.reject();
      this.reset();
      return this;
    },
    reset: function () {
      this.id = null;
      this.deferred = null;
      return this;
    },
    promise: function () {
      if (!this.isRunning()) {
        return;
      }
      return this.deferred.promise();
    }
  };

  var TweetPanel = function () { this.init.apply(this, arguments); };
  TweetPanel.prototype = {
    init: function (el) {
      this.el = el;
      this.scrollDelay = 1000;
      this.pageDelay = 1500;
      this.hideDelay = 10000;
      this.fadeDelay = 500;

      this.waitTimer = new PromiseTimer(this.pageDelay);
      this.hideTimer = new PromiseTimer(this.hideDelay);

      this.hide();
    },
    add: function (args) {
      this.queue.push(args);
      this.dequeue();
    },
    hide: function () {
      this.el.fadeOut(this.fadeDelay);
      this.hideTimer.cancel();
      this.waitTimer.cancel();
      this.visible = false;
      this.queue = [];
      this.active = false;
    },
    show: function () {
      this.visible = true;
      this.el.show();
      this.resize();
    },
    resize: function () {
      this.el.css({ top: $(window).height() - this.el.height() });
    },
    createPlaceHolder: function () {
      var placeHolder = $('<div class="tweet"></div>');
      return placeHolder;
    },
    createTweet: function (args) {
      var tweet = this.createPlaceHolder();
      tweet.append($('#template').children().clone());
      $.each(args, function (key, value) {
        tweet.find('.' + key).text(value);
      });
      tweet.find('img').attr('src', args.profile_image_url);
      return tweet;
    },
    scrollEnd: function () {
      var tweets = this.el.children('.tweet');
      $(tweets[0]).detach();
      this.el.css({ scrollTop: 0 });
    },
    nextQueue: function () {
      this.active = false;
      this.dequeue();
    },
    dequeue: function () {
      var self = this;
      if (this.active) {
        return;
      }
      if (this.queue.length === 0) {
        $.when(this.hideTimer.start(this.hideDelay)).
          done(function () {
            self.hide();
          });
        return;
      }
      this.hideTimer.cancel();
      this.active = true;
      var args = this.queue.pop();
      var tweet = this.createTweet(args);
      if (!this.visible) {
        this.el.empty().append(tweet);
        this.show();
        $.when(this.waitTimer.start(this.pageDelay)).
          done(function () {
            self.nextQueue();
          });
      } else {
        $.when(this.el.
          append(tweet).
          animate(
            { scrollTop: this.el.height() },
            this.scrollDelay
          )
        ).then(function () {
          self.scrollEnd();
          return self.waitTimer.start(this.pageDelay);
        }).done(function () {
          self.nextQueue();
        });
      }
    }
  };

  if (hasModule) {
    module.exports = TweetPanel;
  } else if (typeof defined == 'function' && define.amd) {
    define('TweetPanel', function () {
      return TweetPanel;
    });
  } else {
    global.TweetPanel = TweetPanel;
  }
}).call(this);

/* vi:set sts=2 sw=2 et: */
