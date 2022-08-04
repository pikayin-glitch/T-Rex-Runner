/**
 * @author pikayin
 * 参考来源：谷歌相关源码
 * 仅学习用途
 */
(function () {
    'use strict';
    /**
     * T-Rex runner.
     * @param {string} outerContainerId 外部包含元素id。
     * @param {Object} opt_config
     * @constructor
     * @export
     */
    function Runner(outerContainerId, opt_config) {
        //单例
        if (Runner.instance_) {
            return Runner.instance_;
        }
        Runner.instance_ = this;

        this.outerContainerEl = document.querySelector(outerContainerId);
        this.containerEl = null;
        this.snackbarEl = null;
        this.detailsButton = this.outerContainerEl.querySelector('#details-button');

        this.config = opt_config || Runner.config;

        this.dimensions = Runner.defaultDimensions;

        this.canvas = null;
        this.canvasCtx = null;

        this.tRex = null;

        this.distanceMeter = null;
        this.distanceRan = 0;

        this.highestScore = 0;

        this.time = 0;
        this.runningTime = 0;
        this.msPerFrame = 1000 / FPS;
        this.currentSpeed = this.config.SPEED;

        this.obstacles = [];

        this.playing = false; //游戏当前是否处于运行状态。
        this.crashed = false;
        this.paused = false;
        this.inverted = false;
        this.invertTimer = 0;
        this.resizeTimerId_ = null;

        this.playCount = 0;

        // 音效
        this.audioBuffer = null;
        this.soundFx = {};

        // 音频上下文
        this.audioContext = null;

        // 图片
        this.images = {};
        this.imagesLoaded = 0;

        this.loadImages();
    }
    window['Runner'] = Runner;


    /**
     * 游戏默认宽度
     * @const
     */
    var DEFAULT_WIDTH = 600;

    /**
     * 预定的每秒帧数
     * @const
     */
    var FPS = 60;

    // 像素大小的比率，标准显示器HiDPI
    /** @const */
    var IS_HIDPI = window.devicePixelRatio > 1;

    // IOS系统
    /** @const */
    var IS_IOS = /iPad|iPhone|iPod/.test(window.navigator.platform);

    // 移动...安卓/IOS
    /** @const */
    var IS_MOBILE = /Android/.test(window.navigator.userAgent) || IS_IOS;

    // 判断是否支持touch事件
    /** @const */
    var IS_TOUCH_ENABLED = 'ontouchstart' in window;

    /**
     * 默认游戏配置
     * @enum {number}
     */
    Runner.config = {
        ACCELERATION: 0.001,    //加速度
        BG_CLOUD_SPEED: 0.2,    //背景云速度
        BOTTOM_PAD: 10,         //底部
        CLEAR_TIME: 3000,       //清空时间
        CLOUD_FREQUENCY: 0.5,   //云频率
        GAMEOVER_CLEAR_TIME: 750,//游戏结束清空时间
        GAP_COEFFICIENT: 0.6,   //隙缝系数
        GRAVITY: 0.6,           //仿重力系数
        INITIAL_JUMP_VELOCITY: 12,//初始跳跃速度
        INVERT_FADE_DURATION: 12000,//反转淡入持续时间
        INVERT_DISTANCE: 700,   //反转距离
        MAX_BLINK_COUNT: 3,     //最大BLINK数
        MAX_CLOUDS: 6,          //最大云数
        MAX_OBSTACLE_LENGTH: 3, //最大障碍物长度
        MAX_OBSTACLE_DUPLICATION: 2,//最大障碍物重复
        MAX_SPEED: 13,          //最高速度
        MIN_JUMP_HEIGHT: 35,    //最高跳跃高度
        MOBILE_SPEED_COEFFICIENT: 1.2,//移动端速度系数
        RESOURCE_TEMPLATE_ID: 'audio-resources',
        SPEED: 6,               //速度
        SPEED_DROP_COEFFICIENT: 3   //速度下降系数
    };


    /**
     * 默认尺寸
     * @enum {string}
     */
    Runner.defaultDimensions = {
        WIDTH: DEFAULT_WIDTH,
        HEIGHT: 150
    };


    /**
     * CSS类名
     * @enum {string}
     */
    Runner.classes = {
        CANVAS: 'runner-canvas',
        CONTAINER: 'runner-container',
        CRASHED: 'crashed',
        ICON: 'icon-offline',
        INVERTED: 'inverted',
        SNACKBAR: 'snackbar',
        SNACKBAR_SHOW: 'snackbar-show',
        TOUCH_CONTROLLER: 'controller'
    };


    /**
     * Sprite表单的sprite尺寸
     * @enum {Object}
     */
    Runner.spriteDefinition = {
        // 分辨率LDPI
        LDPI: {
            CACTUS_LARGE: { x: 332, y: 2 },
            CACTUS_SMALL: { x: 228, y: 2 },
            CLOUD: { x: 86, y: 2 },
            HORIZON: { x: 2, y: 54 },
            MOON: { x: 484, y: 2 },
            PTERODACTYL: { x: 134, y: 2 },
            RESTART: { x: 2, y: 2 },
            TEXT_SPRITE: { x: 655, y: 2 },
            TREX: { x: 848, y: 2 },
            STAR: { x: 645, y: 2 }
        },
        // 分辨率HDPI
        HDPI: {
            CACTUS_LARGE: { x: 652, y: 2 },
            CACTUS_SMALL: { x: 446, y: 2 },
            CLOUD: { x: 166, y: 2 },
            HORIZON: { x: 2, y: 104 },
            MOON: { x: 954, y: 2 },
            PTERODACTYL: { x: 260, y: 2 },
            RESTART: { x: 2, y: 2 },
            TEXT_SPRITE: { x: 1294, y: 2 },
            TREX: { x: 1678, y: 2 },
            STAR: { x: 1276, y: 2 }
        }
    };


    /**
     * 声音效果。参考中间页上音频标签的ID。
     * @enum {string}
     */
    Runner.sounds = {
        BUTTON_PRESS: 'offline-sound-press',
        HIT: 'offline-sound-hit',
        SCORE: 'offline-sound-reached'
    };


    /**
     * 键盘映射
     * @enum {Object}
     */
    Runner.keycodes = {
        JUMP: { '38': 1, '32': 1 },  // Up, spacebar
        DUCK: { '40': 1 },  // Down
        RESTART: { '13': 1 }  // Enter
    };


    /**
     * Runner 事件别名
     * @enum {string}
     */
    Runner.events = {
        ANIM_END: 'webkitAnimationEnd',
        CLICK: 'click',
        KEYDOWN: 'keydown',
        KEYUP: 'keyup',
        MOUSEDOWN: 'mousedown',
        MOUSEUP: 'mouseup',
        RESIZE: 'resize',
        TOUCHEND: 'touchend',
        TOUCHSTART: 'touchstart',
        VISIBILITY: 'visibilitychange',
        BLUR: 'blur',
        FOCUS: 'focus',
        LOAD: 'load'
    };


    Runner.prototype = {
        loadImages: function () {
            // 显示器判断
            if (IS_HIDPI) {
                Runner.imageSprite = document.getElementById('offline-resources-2x');
                this.spriteDef = Runner.spriteDefinition.HDPI;
            } else {
                Runner.imageSprite = document.getElementById('offline-resources-1x');
                this.spriteDef = Runner.spriteDefinition.LDPI;
            }

            if (Runner.imageSprite.complete) {
                // 初始化
                this.init();
            } else {
                // 如果图像尚未加载，添加侦听器
                Runner.imageSprite.addEventListener(Runner.events.LOAD,
                    this.init.bind(this));
            }
        },

        /**
         * 加载和解码64进制编码的声音。
         */
        loadSounds: function () {
            if (!IS_IOS) {
                this.audioContext = new AudioContext();

                var resourceTemplate =
                    document.getElementById(this.config.RESOURCE_TEMPLATE_ID).content;

                for (var sound in Runner.sounds) {
                    var soundSrc =
                        resourceTemplate.getElementById(Runner.sounds[sound]).src;
                    soundSrc = soundSrc.substr(soundSrc.indexOf(',') + 1);
                    var buffer = decodeBase64ToArrayBuffer(soundSrc);

                    // 异步，因此不能保证数组中的顺序
                    this.audioContext.decodeAudioData(buffer, function (index, audioData) {
                        this.soundFx[index] = audioData;
                    }.bind(this, sound));
                }
            }
        },

        /**
         * 设置游戏速度。如果屏幕较小，则相应调整速度。
         * @param {number} opt_speed
         */
        setSpeed: function (opt_speed) {
            var speed = opt_speed || this.currentSpeed;

            // 在较小的移动屏幕上降低速度。
            if (this.dimensions.WIDTH < DEFAULT_WIDTH) {
                var mobileSpeed = speed * this.dimensions.WIDTH / DEFAULT_WIDTH *
                    this.config.MOBILE_SPEED_COEFFICIENT;
                this.currentSpeed = mobileSpeed > speed ? speed : mobileSpeed;
            } else if (opt_speed) {
                this.currentSpeed = opt_speed;
            }
        },

        /**
         * 游戏初始化
         */
        init: function () {
            // 隐藏静态图标
            document.querySelector('.' + Runner.classes.ICON).style.visibility =
                'hidden';

            this.adjustDimensions();
            this.setSpeed();

            this.containerEl = document.createElement('div');
            this.containerEl.className = Runner.classes.CONTAINER;

            // 播放器 canvas 容器
            this.canvas = createCanvas(this.containerEl, this.dimensions.WIDTH,
                this.dimensions.HEIGHT, Runner.classes.PLAYER);

            this.canvasCtx = this.canvas.getContext('2d');
            this.canvasCtx.fillStyle = '#f7f7f7';
            this.canvasCtx.fill();
            Runner.updateCanvasScaling(this.canvas);

            //地平线上有云、障碍物和地面
            this.horizon = new Horizon(this.canvas, this.spriteDef, this.dimensions,
                this.config.GAP_COEFFICIENT);

            // 测量距离
            this.distanceMeter = new DistanceMeter(this.canvas,
                this.spriteDef.TEXT_SPRITE, this.dimensions.WIDTH);

            // 画小恐龙
            this.tRex = new Trex(this.canvas, this.spriteDef.TREX);

            this.outerContainerEl.appendChild(this.containerEl);

            if (IS_MOBILE) {
                this.createTouchController();
            }

            this.startListening();
            this.update();

            window.addEventListener(Runner.events.RESIZE,
                this.debounceResize.bind(this));
        },

        /**
         * 创建触摸控制器。覆盖整个屏幕的div。
         */
        createTouchController: function () {
            this.touchController = document.createElement('div');
            this.touchController.className = Runner.classes.TOUCH_CONTROLLER;
            this.outerContainerEl.appendChild(this.touchController);
        },

        /**
         * 取消调整尺寸大小事件的抖动
         */
        debounceResize: function () {
            if (!this.resizeTimerId_) {
                this.resizeTimerId_ =
                    setInterval(this.adjustDimensions.bind(this), 250);
            }
        },

        /**
         * 调整尺寸大小时调整游戏空间尺寸
         */
        adjustDimensions: function () {
            clearInterval(this.resizeTimerId_);
            this.resizeTimerId_ = null;

            var boxStyles = window.getComputedStyle(this.outerContainerEl);
            var padding = Number(boxStyles.paddingLeft.substr(0,
                boxStyles.paddingLeft.length - 2));

            this.dimensions.WIDTH = this.outerContainerEl.offsetWidth - padding * 2;

            // 将元素重新绘制回画布
            if (this.canvas) {
                this.canvas.width = this.dimensions.WIDTH;
                this.canvas.height = this.dimensions.HEIGHT;

                Runner.updateCanvasScaling(this.canvas);

                this.distanceMeter.calcXPos(this.dimensions.WIDTH);
                this.clearCanvas();
                this.horizon.update(0, 0, true);
                this.tRex.update(0);

                // 外部容器
                // 测量距离
                if (this.playing || this.crashed || this.paused) {
                    this.containerEl.style.width = this.dimensions.WIDTH + 'px';
                    this.containerEl.style.height = this.dimensions.HEIGHT + 'px';
                    this.distanceMeter.update(0, Math.ceil(this.distanceRan));
                    this.stop();
                } else {
                    this.tRex.draw(0, 0);
                }

                // 游戏结束面板
                if (this.crashed && this.gameOverPanel) {
                    this.gameOverPanel.updateDimensions(this.dimensions.WIDTH);
                    this.gameOverPanel.draw();
                }
            }
        },

        /**
         * 
         * Canvas容器宽度扩展到全宽。
         */
        playIntro: function () {
            if (!this.activated && !this.crashed) {
                this.playingIntro = true;
                this.tRex.playingIntro = true;

                // CSS动画定义
                var keyframes = '@-webkit-keyframes intro { ' +
                    'from { width:' + Trex.config.WIDTH + 'px }' +
                    'to { width: ' + this.dimensions.WIDTH + 'px }' +
                    '}';

                // 创建用于放置关键帧规则的样式表
                // 然后将样式表放在html的head中  
                var sheet = document.createElement('style');
                sheet.innerHTML = keyframes;
                document.head.appendChild(sheet);

                this.containerEl.addEventListener(Runner.events.ANIM_END,
                    this.startGame.bind(this));

                this.containerEl.style.webkitAnimation = 'intro .4s ease-out 1 both';
                this.containerEl.style.width = this.dimensions.WIDTH + 'px';

                if (this.touchController) {
                    this.outerContainerEl.appendChild(this.touchController);
                }
                this.playing = true;
                
                this.activated = true;
            } else if (this.crashed) {
                this.restart();
            }
        },


        /**
         * 将游戏状态更新为“已开始”
         */
        startGame: function () {
            this.runningTime = 0;
            this.playingIntro = false;
            this.tRex.playingIntro = false;
            this.containerEl.style.webkitAnimation = '';
            this.playCount++;

            // 当焦点从页面上离开。暂停当前游戏。
            document.addEventListener(Runner.events.VISIBILITY,
                this.onVisibilityChange.bind(this));

            window.addEventListener(Runner.events.BLUR,
                this.onVisibilityChange.bind(this));

            window.addEventListener(Runner.events.FOCUS,
                this.onVisibilityChange.bind(this));
        },

        clearCanvas: function () {
            this.canvasCtx.clearRect(0, 0, this.dimensions.WIDTH,
                this.dimensions.HEIGHT);
        },

        /**
         * 更新游戏框架并安排下一个
         */
        update: function () {
            this.updatePending = false;

            var now = getTimeStamp();
            var deltaTime = now - (this.time || now);
            this.time = now;

            if (this.playing) {
                this.clearCanvas();

                if (this.tRex.jumping) {
                    this.tRex.updateJump(deltaTime);
                }

                this.runningTime += deltaTime;
                var hasObstacles = this.runningTime > this.config.CLEAR_TIME;

                // 第一个跳转触发了playIntro
                if (this.tRex.jumpCount == 1 && !this.playingIntro) {
                    this.playIntro();
                }

                // 直到playIntro结束，地平线才会移动
                if (this.playingIntro) {
                    this.horizon.update(0, this.currentSpeed, hasObstacles);
                } else {
                    deltaTime = !this.activated ? 0 : deltaTime;
                    this.horizon.update(deltaTime, this.currentSpeed, hasObstacles,
                        this.inverted);
                }

                // 检测碰撞
                var collision = hasObstacles &&
                    checkForCollision(this.horizon.obstacles[0], this.tRex);

                if (!collision) {
                    this.distanceRan += this.currentSpeed * deltaTime / this.msPerFrame;

                    if (this.currentSpeed < this.config.MAX_SPEED) {
                        this.currentSpeed += this.config.ACCELERATION;
                    }
                } else {
                    this.gameOver();
                }

                var playAchievementSound = this.distanceMeter.update(deltaTime,
                    Math.ceil(this.distanceRan));

                if (playAchievementSound) {
                    this.playSound(this.soundFx.SCORE);
                }

                // 夜间模式
                if (this.invertTimer > this.config.INVERT_FADE_DURATION) {
                    this.invertTimer = 0;
                    this.invertTrigger = false;
                    this.invert();
                } else if (this.invertTimer) {
                    this.invertTimer += deltaTime;
                } else {
                    var actualDistance =
                        this.distanceMeter.getActualDistance(Math.ceil(this.distanceRan));

                    if (actualDistance > 0) {
                        this.invertTrigger = !(actualDistance %
                            this.config.INVERT_DISTANCE);

                        if (this.invertTrigger && this.invertTimer === 0) {
                            this.invertTimer += deltaTime;
                            this.invert();
                        }
                    }
                }
            }

            if (this.playing || (!this.activated &&
                this.tRex.blinkCount < Runner.config.MAX_BLINK_COUNT)) {
                this.tRex.update(deltaTime);
                this.scheduleNextUpdate();
            }
        },

        /**
         * 事件回调
         */
        handleEvent: function (e) {
            return (function (evtType, events) {
                switch (evtType) {
                    case events.KEYDOWN:
                    case events.TOUCHSTART:
                    case events.MOUSEDOWN:
                        this.onKeyDown(e);
                        break;
                    case events.KEYUP:
                    case events.TOUCHEND:
                    case events.MOUSEUP:
                        this.onKeyUp(e);
                        break;
                }
            }.bind(this))(e.type, Runner.events);
        },

        /**
         * 绑定相应的键/鼠标/触摸监听器
         */
        startListening: function () {
            // 键盘
            document.addEventListener(Runner.events.KEYDOWN, this);
            document.addEventListener(Runner.events.KEYUP, this);

            if (IS_MOBILE) {
                // 移动设备触碰
                this.touchController.addEventListener(Runner.events.TOUCHSTART, this);
                this.touchController.addEventListener(Runner.events.TOUCHEND, this);
                this.containerEl.addEventListener(Runner.events.TOUCHSTART, this);
            } else {
                // 鼠标
                document.addEventListener(Runner.events.MOUSEDOWN, this);
                document.addEventListener(Runner.events.MOUSEUP, this);
            }
        },

        /**
         * 移除所有的监听.
         */
        stopListening: function () {
            document.removeEventListener(Runner.events.KEYDOWN, this);
            document.removeEventListener(Runner.events.KEYUP, this);

            if (IS_MOBILE) {
                this.touchController.removeEventListener(Runner.events.TOUCHSTART, this);
                this.touchController.removeEventListener(Runner.events.TOUCHEND, this);
                this.containerEl.removeEventListener(Runner.events.TOUCHSTART, this);
            } else {
                document.removeEventListener(Runner.events.MOUSEDOWN, this);
                document.removeEventListener(Runner.events.MOUSEUP, this);
            }
        },

        /**
         * 方向下键的设置.
         * @param {Event} e
         */
        onKeyDown: function (e) {
            // 点击移动设备时防止本机页面滚动
            if (IS_MOBILE && this.playing) {
                e.preventDefault();
            }

            if (e.target != this.detailsButton) {
                if (!this.crashed && (Runner.keycodes.JUMP[e.keyCode] ||
                    e.type == Runner.events.TOUCHSTART)) {
                    if (!this.playing) {
                        this.loadSounds();
                        this.playing = true;
                        this.update();
                        if (window.errorPageController) {
                            errorPageController.trackEasterEgg();
                        }
                    }
                    // 第一次开始游戏时播放音效并跳跃
                    if (!this.tRex.jumping && !this.tRex.ducking) {
                        this.playSound(this.soundFx.BUTTON_PRESS);
                        this.tRex.startJump(this.currentSpeed);
                    }
                }

                if (this.crashed && e.type == Runner.events.TOUCHSTART &&
                    e.currentTarget == this.containerEl) {
                    this.restart();
                }
            }

            if (this.playing && !this.crashed && Runner.keycodes.DUCK[e.keyCode]) {
                e.preventDefault();
                if (this.tRex.jumping) {
                    // 速度下降，仅在未按下跳跃键时激活。
                    this.tRex.setSpeedDrop();
                } else if (!this.tRex.jumping && !this.tRex.ducking) {
                    // 匍匐
                    this.tRex.setDuck(true);
                }
            }
        },


        /**
         * 方向上键的设置
         * @param {Event} e
         */
        onKeyUp: function (e) {
            var keyCode = String(e.keyCode);
            var isjumpKey = Runner.keycodes.JUMP[keyCode] ||
                e.type == Runner.events.TOUCHEND ||
                e.type == Runner.events.MOUSEDOWN;

            if (this.isRunning() && isjumpKey) {
                this.tRex.endJump();
            } else if (Runner.keycodes.DUCK[keyCode]) {
                this.tRex.speedDrop = false;
                this.tRex.setDuck(false);
            } else if (this.crashed) {
                // 在允许跳跃键重新启动之前，请检查是否经过足够的时间
                var deltaTime = getTimeStamp() - this.time;

                if (Runner.keycodes.RESTART[keyCode] || this.isLeftClickOnCanvas(e) ||
                    (deltaTime >= this.config.GAMEOVER_CLEAR_TIME &&
                        Runner.keycodes.JUMP[keyCode])) {
                    this.restart();
                }
            } else if (this.paused && isjumpKey) {
                // 重置跳跃状态
                this.tRex.reset();
                this.play();
            }
        },

        /**
         * 返回事件是否是在画布上单击鼠标左键。在Windows上，右键单击注册为单击。
         * 
         * @param {Event} e
         * @return {boolean}
         */
        isLeftClickOnCanvas: function (e) {
            return e.button != null && e.button < 2 &&
                e.type == Runner.events.MOUSEUP && e.target == this.canvas;
        },

        /**
         * RequestAnimationFrame 包装器
         */
        scheduleNextUpdate: function () {
            if (!this.updatePending) {
                this.updatePending = true;
                this.raqId = requestAnimationFrame(this.update.bind(this));
            }
        },

        /**
         * 游戏是否正在运行
         * @return {boolean}
         */
        isRunning: function () {
            return !!this.raqId;
        },

        /**
         * 游戏结束状态
         */
        gameOver: function () {
            this.playSound(this.soundFx.HIT);
            vibrate(200);

            this.stop();
            this.crashed = true;
            this.distanceMeter.acheivement = false;

            this.tRex.update(100, Trex.status.CRASHED);

            // 游戏结束面板
            if (!this.gameOverPanel) {
                this.gameOverPanel = new GameOverPanel(this.canvas,
                    this.spriteDef.TEXT_SPRITE, this.spriteDef.RESTART,
                    this.dimensions);
            } else {
                this.gameOverPanel.draw();
            }

            // 更新最高分数
            if (this.distanceRan > this.highestScore) {
                this.highestScore = Math.ceil(this.distanceRan);
                this.distanceMeter.setHighScore(this.highestScore);
            }

            // 重置时钟
            this.time = getTimeStamp();
        },

        stop: function () {
            this.playing = false;
            this.paused = true;
            cancelAnimationFrame(this.raqId);
            this.raqId = 0;
        },

        play: function () {
            if (!this.crashed) {
                this.playing = true;
                this.paused = false;
                this.tRex.update(0, Trex.status.RUNNING);
                this.time = getTimeStamp();
                this.update();
            }
        },

        restart: function () {
            if (!this.raqId) {
                this.playCount++;
                this.runningTime = 0;
                this.playing = true;
                this.crashed = false;
                this.distanceRan = 0;
                this.setSpeed(this.config.SPEED);
                this.time = getTimeStamp();
                this.containerEl.classList.remove(Runner.classes.CRASHED);
                this.clearCanvas();
                this.distanceMeter.reset(this.highestScore);
                this.horizon.reset();
                this.tRex.reset();
                this.playSound(this.soundFx.BUTTON_PRESS);
                this.invert(true);
                this.update();
            }
        },

        /**
         * 页面失去焦点时暂停游戏
         */
        onVisibilityChange: function (e) {
            if (document.hidden || document.webkitHidden || e.type == 'blur' ||
                document.visibilityState != 'visible') {
                this.stop();
            } else if (!this.crashed) {
                this.tRex.reset();
                this.play();
            }
        },

        /**
         * 音效.
         * @param {SoundBuffer} soundBuffer
         */
        playSound: function (soundBuffer) {
            if (soundBuffer) {
                var sourceNode = this.audioContext.createBufferSource();
                sourceNode.buffer = soundBuffer;
                sourceNode.connect(this.audioContext.destination);
                sourceNode.start(0);
            }
        },

        /**
         * 重置当前页面/画布颜色
         * @param {boolean} Whether 重置颜色
         */
        invert: function (reset) {
            if (reset) {
                document.body.classList.toggle(Runner.classes.INVERTED, false);
                this.invertTimer = 0;
                this.inverted = false;
            } else {
                this.inverted = document.body.classList.toggle(Runner.classes.INVERTED,
                    this.invertTrigger);
            }
        }
    };


    /**
     * 更新画布大小，同时考虑存储像素比率和设备像素比率。
     *
     * 参考文章：
     * http://www.html5rocks.com/en/tutorials/canvas/hidpi/
     *
     * @param {HTMLCanvasElement} canvas
     * @param {number} opt_width
     * @param {number} opt_height
     * @return {boolean} 画布是否缩放
     */
    Runner.updateCanvasScaling = function (canvas, opt_width, opt_height) {
        var context = canvas.getContext('2d');

        // 查询各种像素比率
        var devicePixelRatio = Math.floor(window.devicePixelRatio) || 1;
        var backingStoreRatio = Math.floor(context.webkitBackingStorePixelRatio) || 1;
        var ratio = devicePixelRatio / backingStoreRatio;

        // 如果两个比率不匹配，则放大画布
        if (devicePixelRatio !== backingStoreRatio) {
            var oldWidth = opt_width || canvas.width;
            var oldHeight = opt_height || canvas.height;

            canvas.width = oldWidth * ratio;
            canvas.height = oldHeight * ratio;

            canvas.style.width = oldWidth + 'px';
            canvas.style.height = oldHeight + 'px';

            // 缩放上下文以应对我们手动缩放的情况
            // canvas 元素
            context.scale(ratio, ratio);
            return true;
        } else if (devicePixelRatio == 1) {
            // 重置canvas的宽高. 修复缩放错误当页面被缩放
            // 以及 devicePixelRatio 相应变化
            canvas.style.width = canvas.width + 'px';
            canvas.style.height = canvas.height + 'px';
        }
        return false;
    };


    /**
     * 获取随机数
     * @param {number} min
     * @param {number} max
     * @param {number}
     */
    function getRandomNum(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }


    /**
     * 在移动设备上振动。
     * @param {number} duration 振动持续时间（毫秒）.
     */
    function vibrate(duration) {
        if (IS_MOBILE && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }

    /**
     * 创建canvas
     * @param {HTMLElement} container 将canvas添加的元素
     * @param {number} width
     * @param {number} height
     * @param {string} opt_classname
     * @return {HTMLCanvasElement}
     */
    function createCanvas(container, width, height, opt_classname) {
        var canvas = document.createElement('canvas');
        canvas.className = opt_classname ? Runner.classes.CANVAS + ' ' +
            opt_classname : Runner.classes.CANVAS;
        canvas.width = width;
        canvas.height = height;
        container.appendChild(canvas);

        return canvas;
    }


    /**
     * 将base 64 audio解码为Web audio使用的ArrayBuffer
     * @param {string} base64String
     */
    function decodeBase64ToArrayBuffer(base64String) {
        var len = (base64String.length / 4) * 3;
        var str = atob(base64String);
        var arrayBuffer = new ArrayBuffer(len);
        var bytes = new Uint8Array(arrayBuffer);

        for (var i = 0; i < len; i++) {
            bytes[i] = str.charCodeAt(i);
        }
        return bytes.buffer;
    }


    /**
     * 返回当前时间戳
     * @return {number}
     */
    function getTimeStamp() {
        return IS_IOS ? new Date().getTime() : performance.now();
    }


    /******************************************************************************
    *******************************************************************************/


    /**
     * 游戏结束面板
     * @param {!HTMLCanvasElement} canvas
     * @param {Object} textImgPos
     * @param {Object} restartImgPos
     * @param {!Object} dimensions 画布尺寸
     * @constructor
     */
    function GameOverPanel(canvas, textImgPos, restartImgPos, dimensions) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.canvasDimensions = dimensions;
        this.textImgPos = textImgPos;
        this.restartImgPos = restartImgPos;
        this.draw();
    };


    /**
     * 画板中要用到的尺寸
     * @enum {number}
     */
    GameOverPanel.dimensions = {
        TEXT_X: 0,
        TEXT_Y: 13,
        TEXT_WIDTH: 191,
        TEXT_HEIGHT: 11,
        RESTART_WIDTH: 36,
        RESTART_HEIGHT: 32
    };


    GameOverPanel.prototype = {
        /**
         * 更新面板尺寸
         * @param {number} width 新的canvas宽度
         * @param {number} opt_height 可选的canvas高度
         */
        updateDimensions: function (width, opt_height) {
            this.canvasDimensions.WIDTH = width;
            if (opt_height) {
                this.canvasDimensions.HEIGHT = opt_height;
            }
        },

        /**
         * 绘制面板
         */
        draw: function () {
            var dimensions = GameOverPanel.dimensions;

            var centerX = this.canvasDimensions.WIDTH / 2;

            // 游戏结束文本
            var textSourceX = dimensions.TEXT_X;
            var textSourceY = dimensions.TEXT_Y;
            var textSourceWidth = dimensions.TEXT_WIDTH;
            var textSourceHeight = dimensions.TEXT_HEIGHT;

            var textTargetX = Math.round(centerX - (dimensions.TEXT_WIDTH / 2));
            var textTargetY = Math.round((this.canvasDimensions.HEIGHT - 25) / 3);
            var textTargetWidth = dimensions.TEXT_WIDTH;
            var textTargetHeight = dimensions.TEXT_HEIGHT;

            var restartSourceWidth = dimensions.RESTART_WIDTH;
            var restartSourceHeight = dimensions.RESTART_HEIGHT;
            var restartTargetX = centerX - (dimensions.RESTART_WIDTH / 2);
            var restartTargetY = this.canvasDimensions.HEIGHT / 2;

            if (IS_HIDPI) {
                textSourceY *= 2;
                textSourceX *= 2;
                textSourceWidth *= 2;
                textSourceHeight *= 2;
                restartSourceWidth *= 2;
                restartSourceHeight *= 2;
            }

            textSourceX += this.textImgPos.x;
            textSourceY += this.textImgPos.y;

            // sprite 游戏结束文本
            this.canvasCtx.drawImage(Runner.imageSprite,
                textSourceX, textSourceY, textSourceWidth, textSourceHeight,
                textTargetX, textTargetY, textTargetWidth, textTargetHeight);

            // 重新开始按钮.
            this.canvasCtx.drawImage(Runner.imageSprite,
                this.restartImgPos.x, this.restartImgPos.y,
                restartSourceWidth, restartSourceHeight,
                restartTargetX, restartTargetY, dimensions.RESTART_WIDTH,
                dimensions.RESTART_HEIGHT);
        }
    };

    /******************************************************************************
        ******************************************************************************
        ******************************************************************************
        *******************************************************************************/


    /**
     * 检测碰撞
     * @param {!Obstacle} obstacle
     * @param {!Trex} tRex 小恐龙对象.
     * @param {HTMLCanvasContext} opt_canvasCtx 绘图的可选canvas上下文
     *    碰撞体积.
     * @return {Array<CollisionBox>}
     */
    function checkForCollision(obstacle, tRex, opt_canvasCtx) {
        var obstacleBoxXPos = Runner.defaultDimensions.WIDTH + obstacle.xPos;

        // 当有一个1像素的白色，对边界框进行了调整
        // 霸王龙和障碍物周围的边界
        var tRexBox = new CollisionBox(
            tRex.xPos + 1,
            tRex.yPos + 1,
            tRex.config.WIDTH - 2,
            tRex.config.HEIGHT - 2);

        var obstacleBox = new CollisionBox(
            obstacle.xPos + 1,
            obstacle.yPos + 1,
            obstacle.typeConfig.width * obstacle.size - 2,
            obstacle.typeConfig.height - 2);

        // 调试外部box
        if (opt_canvasCtx) {
            drawCollisionBoxes(opt_canvasCtx, tRexBox, obstacleBox);
        }

        // 简单的外部边界检查
        if (boxCompare(tRexBox, obstacleBox)) {
            var collisionBoxes = obstacle.collisionBoxes;
            var tRexCollisionBoxes = tRex.ducking ?
                Trex.collisionBoxes.DUCKING : Trex.collisionBoxes.RUNNING;

            // 详细的轴对齐复选框
            for (var t = 0; t < tRexCollisionBoxes.length; t++) {
                for (var i = 0; i < collisionBoxes.length; i++) {
                    // 将碰撞体积调整到实际位置
                    var adjTrexBox =
                        createAdjustedCollisionBox(tRexCollisionBoxes[t], tRexBox);
                    var adjObstacleBox =
                        createAdjustedCollisionBox(collisionBoxes[i], obstacleBox);
                    var crashed = boxCompare(adjTrexBox, adjObstacleBox);

                    // 绘制调试后的碰撞体积
                    if (opt_canvasCtx) {
                        drawCollisionBoxes(opt_canvasCtx, adjTrexBox, adjObstacleBox);
                    }

                    if (crashed) {
                        return [adjTrexBox, adjObstacleBox];
                    }
                }
            }
        }
        return false;
    };

    /**
     * 调整碰撞体积
     * @param {!CollisionBox} box 原始box
     * @param {!CollisionBox} adjustment 调整的box
     * @return {CollisionBox} 调整后的box对象
     */
    function createAdjustedCollisionBox(box, adjustment) {
        return new CollisionBox(
            box.x + adjustment.x,
            box.y + adjustment.y,
            box.width,
            box.height);
    };

    /**
     * 绘制碰撞框用于调试
     */
    function drawCollisionBoxes(canvasCtx, tRexBox, obstacleBox) {
        canvasCtx.save();
        canvasCtx.strokeStyle = '#f00';
        canvasCtx.strokeRect(tRexBox.x, tRexBox.y, tRexBox.width, tRexBox.height);

        canvasCtx.strokeStyle = '#0f0';
        canvasCtx.strokeRect(obstacleBox.x, obstacleBox.y,
            obstacleBox.width, obstacleBox.height);
        canvasCtx.restore();
    };

    /**
     * 碰撞时对比两个碰撞体积
     * @param {CollisionBox} tRexBox
     * @param {CollisionBox} obstacleBox
     * @return {boolean} 碰撞体积是否有重合部分
     */
    function boxCompare(tRexBox, obstacleBox) {
        var crashed = false;
        var tRexBoxX = tRexBox.x;
        var tRexBoxY = tRexBox.y;

        var obstacleBoxX = obstacleBox.x;
        var obstacleBoxY = obstacleBox.y;

        // 轴对齐边界框方法
        if (tRexBox.x < obstacleBoxX + obstacleBox.width &&
            tRexBox.x + tRexBox.width > obstacleBoxX &&
            tRexBox.y < obstacleBox.y + obstacleBox.height &&
            tRexBox.height + tRexBox.y > obstacleBox.y) {
            crashed = true;
        }

        return crashed;
    };

    //******************************************************************************

    /**
     * 碰撞框对象
     * @param {number} x X position.
     * @param {number} y Y Position.
     * @param {number} w Width.
     * @param {number} h Height.
     */
    function CollisionBox(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    };

    //******************************************************************************

    /**
     * 障碍物.
     * @param {HTMLCanvasCtx} canvasCtx
     * @param {Obstacle.type} type
     * @param {Object} spritePos sprite中的障碍物位置
     * @param {Object} dimensions
     * @param {number} gapCoefficient 确定间隙时的倍增器
     * @param {number} speed
     * @param {number} opt_xOffset
     */
    function Obstacle(canvasCtx, type, spriteImgPos, dimensions,
        gapCoefficient, speed, opt_xOffset) {

        this.canvasCtx = canvasCtx;
        this.spritePos = spriteImgPos;
        this.typeConfig = type;
        this.gapCoefficient = gapCoefficient;
        this.size = getRandomNum(1, Obstacle.MAX_OBSTACLE_LENGTH);
        this.dimensions = dimensions;
        this.remove = false;
        this.xPos = dimensions.WIDTH + (opt_xOffset || 0);
        this.yPos = 0;
        this.width = 0;
        this.collisionBoxes = [];
        this.gap = 0;
        this.speedOffset = 0;

        // 动画障碍物
        this.currentFrame = 0;
        this.timer = 0;

        this.init(speed);
    };

    /**
     * 计算最大间隙的系数
     * @const
     */
    Obstacle.MAX_GAP_COEFFICIENT = 1.5;

    /**
     * 最大障碍物分组数.
     * @const
     */
    Obstacle.MAX_OBSTACLE_LENGTH = 3,


        Obstacle.prototype = {
            /**
             * 初始化障碍物的DOM.
             * @param {number} speed
             */
            init: function (speed) {
                this.cloneCollisionBoxes();

                // 只有在速度合适的情况下才允许调整尺寸.
                if (this.size > 1 && this.typeConfig.multipleSpeed > speed) {
                    this.size = 1;
                }

                this.width = this.typeConfig.width * this.size;

                // 检查障碍物是否可以放置在不同高度
                if (Array.isArray(this.typeConfig.yPos)) {
                    var yPosConfig = IS_MOBILE ? this.typeConfig.yPosMobile :
                        this.typeConfig.yPos;
                    this.yPos = yPosConfig[getRandomNum(0, yPosConfig.length - 1)];
                } else {
                    this.yPos = this.typeConfig.yPos;
                }

                this.draw();

                // 进行碰撞盒调整
                // 中央盒子调整为一个盒子大小.
                //      ____        ______        ________
                //    _|   |-|    _|     |-|    _|       |-|
                //   | |<->| |   | |<--->| |   | |<----->| |
                //   | | 1 | |   | |  2  | |   | |   3   | |
                //   |_|___|_|   |_|_____|_|   |_|_______|_|
                //
                if (this.size > 1) {
                    this.collisionBoxes[1].width = this.width - this.collisionBoxes[0].width -
                        this.collisionBoxes[2].width;
                    this.collisionBoxes[2].x = this.width - this.collisionBoxes[2].width;
                }

                // 对于与地平线速度不同的障碍物
                if (this.typeConfig.speedOffset) {
                    this.speedOffset = Math.random() > 0.5 ? this.typeConfig.speedOffset :
                        -this.typeConfig.speedOffset;
                }

                this.gap = this.getGap(this.gapCoefficient, speed);
            },

            /**
             * 根据大小来绘制和裁剪
             */
            draw: function () {
                var sourceWidth = this.typeConfig.width;
                var sourceHeight = this.typeConfig.height;

                if (IS_HIDPI) {
                    sourceWidth = sourceWidth * 2;
                    sourceHeight = sourceHeight * 2;
                }

                // sprite中的X位置
                var sourceX = (sourceWidth * this.size) * (0.5 * (this.size - 1)) +
                    this.spritePos.x;

                // 动画帧
                if (this.currentFrame > 0) {
                    sourceX += sourceWidth * this.currentFrame;
                }

                this.canvasCtx.drawImage(Runner.imageSprite,
                    sourceX, this.spritePos.y,
                    sourceWidth * this.size, sourceHeight,
                    this.xPos, this.yPos,
                    this.typeConfig.width * this.size, this.typeConfig.height);
            },

            /**
             * 更新障碍物帧.
             * @param {number} deltaTime
             * @param {number} speed
             */
            update: function (deltaTime, speed) {
                if (!this.remove) {
                    if (this.typeConfig.speedOffset) {
                        speed += this.speedOffset;
                    }
                    this.xPos -= Math.floor((speed * FPS / 1000) * deltaTime);

                    // 更新帧
                    if (this.typeConfig.numFrames) {
                        this.timer += deltaTime;
                        if (this.timer >= this.typeConfig.frameRate) {
                            this.currentFrame =
                                this.currentFrame == this.typeConfig.numFrames - 1 ?
                                    0 : this.currentFrame + 1;
                            this.timer = 0;
                        }
                    }
                    this.draw();

                    if (!this.isVisible()) {
                        this.remove = true;
                    }
                }
            },

            /**
             * 计算随机间隙大小
             * - 随着速度的增加，最小间隙变宽
             * @param {number} gapCoefficient
             * @param {number} speed
             * @return {number} 间隙大小
             */
            getGap: function (gapCoefficient, speed) {
                var minGap = Math.round(this.width * speed +
                    this.typeConfig.minGap * gapCoefficient);
                var maxGap = Math.round(minGap * Obstacle.MAX_GAP_COEFFICIENT);
                return getRandomNum(minGap, maxGap);
            },
            /**
             * 检查障碍物是否可见
             * @return {boolean} 确认障碍物是否在游戏区域内。
             */
            isVisible: function () {
                return this.xPos + this.width > 0;
            },

            /**
             * 复制碰撞盒，因为它们将根据障碍物类型和大小改变。
             */
            cloneCollisionBoxes: function () {
                var collisionBoxes = this.typeConfig.collisionBoxes;

                for (var i = collisionBoxes.length - 1; i >= 0; i--) {
                    this.collisionBoxes[i] = new CollisionBox(collisionBoxes[i].x,
                        collisionBoxes[i].y, collisionBoxes[i].width,
                        collisionBoxes[i].height);
                }
            }
        };


    /**
     * 障碍物定义.
     * minGap: 障碍物之间的最小像素空间
     * multipleSpeed: 允许多路的速度
     * speedOffset: 速度比地平线快/慢
     * minSpeed: 障碍物可能出现的最小速度
     */
    Obstacle.types = [
        {
            type: 'CACTUS_SMALL',
            width: 17,
            height: 35,
            yPos: 105,
            multipleSpeed: 4,
            minGap: 120,
            minSpeed: 0,
            collisionBoxes: [
                new CollisionBox(0, 7, 5, 27),
                new CollisionBox(4, 0, 6, 34),
                new CollisionBox(10, 4, 7, 14)
            ]
        },
        {
            type: 'CACTUS_LARGE',
            width: 25,
            height: 50,
            yPos: 90,
            multipleSpeed: 7,
            minGap: 120,
            minSpeed: 0,
            collisionBoxes: [
                new CollisionBox(0, 12, 7, 38),
                new CollisionBox(8, 0, 7, 49),
                new CollisionBox(13, 10, 10, 38)
            ]
        },
        {
            type: 'PTERODACTYL',
            width: 46,
            height: 40,
            yPos: [100, 75, 50], // 可变高度
            yPosMobile: [100, 50], // 移动设备的可变高度
            multipleSpeed: 999,
            minSpeed: 8.5,
            minGap: 150,
            collisionBoxes: [
                new CollisionBox(15, 15, 16, 5),
                new CollisionBox(18, 21, 24, 6),
                new CollisionBox(2, 14, 4, 3),
                new CollisionBox(6, 10, 4, 7),
                new CollisionBox(10, 8, 6, 9)
            ],
            numFrames: 2,
            frameRate: 1000 / 6,
            speedOffset: .8
        }
    ];
    //******************************************************************************
    /**
     * T-rex game character.
     * @param {HTMLCanvas} canvas
     * @param {Object} spritePos Positioning within image sprite.
     * @constructor
     */
    function Trex(canvas, spritePos) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.spritePos = spritePos;
        this.xPos = 0;
        this.yPos = 0;
        // 在地面上定位
        this.groundYPos = 0;
        this.currentFrame = 0;
        this.currentAnimFrames = [];
        this.blinkDelay = 0;
        this.blinkCount = 0;
        this.animStartTime = 0;
        this.timer = 0;
        this.msPerFrame = 1000 / FPS;
        this.config = Trex.config;
        // 当前状态
        this.status = Trex.status.WAITING;

        this.jumping = false;
        this.ducking = false;
        this.jumpVelocity = 0;
        this.reachedMinHeight = false;
        this.speedDrop = false;
        this.jumpCount = 0;
        this.jumpspotX = 0;

        this.init();
    };


    /**
     * 霸王龙配置
     * @enum {number}
     */
    Trex.config = {
        DROP_VELOCITY: -5,
        GRAVITY: 0.6,
        HEIGHT: 47,
        HEIGHT_DUCK: 25,
        INIITAL_JUMP_VELOCITY: -10,
        INTRO_DURATION: 1500,
        MAX_JUMP_HEIGHT: 30,
        MIN_JUMP_HEIGHT: 30,
        SPEED_DROP_COEFFICIENT: 3,
        SPRITE_WIDTH: 262,
        START_X_POS: 50,
        WIDTH: 44,
        WIDTH_DUCK: 59
    };


    /**
     * 用于碰撞检测
     * @type {Array<CollisionBox>}
     */
    Trex.collisionBoxes = {
        DUCKING: [
            new CollisionBox(1, 18, 55, 25)
        ],
        RUNNING: [
            new CollisionBox(22, 0, 17, 16),
            new CollisionBox(1, 18, 30, 9),
            new CollisionBox(10, 35, 14, 8),
            new CollisionBox(1, 24, 29, 5),
            new CollisionBox(5, 30, 21, 4),
            new CollisionBox(9, 34, 15, 4)
        ]
    };


    /**
     * 动画状态
     * @enum {string}
     */
    Trex.status = {
        CRASHED: 'CRASHED',
        DUCKING: 'DUCKING',
        JUMPING: 'JUMPING',
        RUNNING: 'RUNNING',
        WAITING: 'WAITING'
    };

    /**
     * 闪烁系数
     * @const
     */
    Trex.BLINK_TIMING = 7000;


    /**
     * 不同状态的动画配置
     * @enum {Object}
     */
    Trex.animFrames = {
        WAITING: {
            frames: [44, 0],
            msPerFrame: 1000 / 3
        },
        RUNNING: {
            frames: [88, 132],
            msPerFrame: 1000 / 12
        },
        CRASHED: {
            frames: [220],
            msPerFrame: 1000 / 60
        },
        JUMPING: {
            frames: [0],
            msPerFrame: 1000 / 60
        },
        DUCKING: {
            frames: [264, 323],
            msPerFrame: 1000 / 8
        }
    };


    Trex.prototype = {
        /**
         * 霸王龙启动
         * 霸王龙以随机间隔闪烁
         */
        init: function () {
            this.groundYPos = Runner.defaultDimensions.HEIGHT - this.config.HEIGHT -
                Runner.config.BOTTOM_PAD;
            this.yPos = this.groundYPos;
            this.minJumpHeight = this.groundYPos - this.config.MIN_JUMP_HEIGHT;

            this.draw(0, 0);
            this.update(0, Trex.status.WAITING);
        },

        /**
         * 设定跳跃速度
         * 并设定合适的下落速度
         */
        setJumpVelocity: function (setting) {
            this.config.INIITAL_JUMP_VELOCITY = -setting;
            this.config.DROP_VELOCITY = -setting / 2;
        },

        /**
         * 设置动画状态
         * @param {!number} deltaTime
         * @param {Trex.status} status 切换的可选状态
         */
        update: function (deltaTime, opt_status) {
            this.timer += deltaTime;

            // 更新状态
            if (opt_status) {
                this.status = opt_status;
                this.currentFrame = 0;
                this.msPerFrame = Trex.animFrames[opt_status].msPerFrame;
                this.currentAnimFrames = Trex.animFrames[opt_status].frames;

                if (opt_status == Trex.status.WAITING) {
                    this.animStartTime = getTimeStamp();
                    this.setBlinkDelay();
                }
            }

            // 霸王龙从左侧移动
            if (this.playingIntro && this.xPos < this.config.START_X_POS) {
                this.xPos += Math.round((this.config.START_X_POS /
                    this.config.INTRO_DURATION) * deltaTime);
            }

            if (this.status == Trex.status.WAITING) {
                this.blink(getTimeStamp());
            } else {
                this.draw(this.currentAnimFrames[this.currentFrame], 0);
            }

            // 更新帧位置
            if (this.timer >= this.msPerFrame) {
                this.currentFrame = this.currentFrame ==
                    this.currentAnimFrames.length - 1 ? 0 : this.currentFrame + 1;
                this.timer = 0;
            }

            // 如果依然按方向下键，则变为匍匐状态。
            if (this.speedDrop && this.yPos == this.groundYPos) {
                this.speedDrop = false;
                this.setDuck(true);
            }
        },

        /**
         * 将霸王龙绘制到指定位置。
         * @param {number} x
         * @param {number} y
         */
        draw: function (x, y) {
            var sourceX = x;
            var sourceY = y;
            var sourceWidth = this.ducking && this.status != Trex.status.CRASHED ?
                this.config.WIDTH_DUCK : this.config.WIDTH;
            var sourceHeight = this.config.HEIGHT;

            if (IS_HIDPI) {
                sourceX *= 2;
                sourceY *= 2;
                sourceWidth *= 2;
                sourceHeight *= 2;
            }

            // 调整spritesheet的位置
            sourceX += this.spritePos.x;
            sourceY += this.spritePos.y;

            // 匍匐.
            if (this.ducking && this.status != Trex.status.CRASHED) {
                this.canvasCtx.drawImage(Runner.imageSprite, sourceX, sourceY,
                    sourceWidth, sourceHeight,
                    this.xPos, this.yPos,
                    this.config.WIDTH_DUCK, this.config.HEIGHT);
            } else {
                // 在匍匐时发生碰撞。小恐龙站起来了，所以需要调整
                if (this.ducking && this.status == Trex.status.CRASHED) {
                    this.xPos++;
                }
                // 站立 / 奔跑
                this.canvasCtx.drawImage(Runner.imageSprite, sourceX, sourceY,
                    sourceWidth, sourceHeight,
                    this.xPos, this.yPos,
                    this.config.WIDTH, this.config.HEIGHT);
            }
        },

        /**
         * 设置闪烁发生的随机时间.
         */
        setBlinkDelay: function () {
            this.blinkDelay = Math.ceil(Math.random() * Trex.BLINK_TIMING);
        },

        /**
         * 让霸王龙以随机间隔闪烁
         * @param {number} time 当前时间（毫秒）
         */
        blink: function (time) {
            var deltaTime = time - this.animStartTime;

            if (deltaTime >= this.blinkDelay) {
                this.draw(this.currentAnimFrames[this.currentFrame], 0);

                if (this.currentFrame == 1) {
                    // 将新的随机延迟设置为闪烁。
                    this.setBlinkDelay();
                    this.animStartTime = time;
                    this.blinkCount++;
                }
            }
        },

        /**
         * 跳跃初始化
         * @param {number} speed
         */
        startJump: function (speed) {
            if (!this.jumping) {
                this.update(0, Trex.status.JUMPING);
                // 根据速度调整跳跃的速度
                this.jumpVelocity = this.config.INIITAL_JUMP_VELOCITY - (speed / 10);
                this.jumping = true;
                this.reachedMinHeight = false;
                this.speedDrop = false;
            }
        },

        /**
         * 跳跃完成，开始下落
         */
        endJump: function () {
            if (this.reachedMinHeight &&
                this.jumpVelocity < this.config.DROP_VELOCITY) {
                this.jumpVelocity = this.config.DROP_VELOCITY;
            }
        },

        /**
         * 更新跳跃帧
         * @param {number} deltaTime
         * @param {number} speed
         */
        updateJump: function (deltaTime, speed) {
            var msPerFrame = Trex.animFrames[this.status].msPerFrame;
            var framesElapsed = deltaTime / msPerFrame;

            // 方向下键让小恐龙快速下落
            if (this.speedDrop) {
                this.yPos += Math.round(this.jumpVelocity *
                    this.config.SPEED_DROP_COEFFICIENT * framesElapsed);
            } else {
                this.yPos += Math.round(this.jumpVelocity * framesElapsed);
            }

            this.jumpVelocity += this.config.GRAVITY * framesElapsed;

            // 已达到最小高度
            if (this.yPos < this.minJumpHeight || this.speedDrop) {
                this.reachedMinHeight = true;
            }

            // 已达到最大高度
            if (this.yPos < this.config.MAX_JUMP_HEIGHT || this.speedDrop) {
                this.endJump();
            }

            // 回到地面高度，跳跃完成
            if (this.yPos > this.groundYPos) {
                this.reset();
                this.jumpCount++;
            }

            this.update(deltaTime);
        },

        /**
         * 方向下键立即取消当前跳跃
         */
        setSpeedDrop: function () {
            this.speedDrop = true;
            this.jumpVelocity = 1;
        },

        /**
         * @param {boolean} isDucking.
         */
        setDuck: function (isDucking) {
            if (isDucking && this.status != Trex.status.DUCKING) {
                this.update(0, Trex.status.DUCKING);
                this.ducking = true;
            } else if (this.status == Trex.status.DUCKING) {
                this.update(0, Trex.status.RUNNING);
                this.ducking = false;
            }
        },

        /**
         * 游戏开始时，将霸王龙重置为跑步状态
         */
        reset: function () {
            this.yPos = this.groundYPos;
            this.jumpVelocity = 0;
            this.jumping = false;
            this.ducking = false;
            this.update(0, Trex.status.RUNNING);
            this.midair = false;
            this.speedDrop = false;
            this.jumpCount = 0;
        }
    };
    //******************************************************************************
    /**
     * 距离测量的回调
     * @param {!HTMLCanvasElement} canvas
     * @param {Object} spritePos sprite的图片定位
     * @param {number} canvasWidth
     * @constructor
     */
    function DistanceMeter(canvas, spritePos, canvasWidth) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.image = Runner.imageSprite;
        this.spritePos = spritePos;
        this.x = 0;
        this.y = 5;

        this.currentDistance = 0;
        this.maxScore = 0;
        this.highScore = 0;
        this.container = null;

        this.digits = [];
        this.acheivement = false;
        this.defaultString = '';
        this.flashTimer = 0;
        this.flashIterations = 0;
        this.invertTrigger = false;

        this.config = DistanceMeter.config;
        this.maxScoreUnits = this.config.MAX_DISTANCE_UNITS;
        this.init(canvasWidth);
    };

    /**
     * @enum {number}
     */
    DistanceMeter.dimensions = {
        WIDTH: 10,
        HEIGHT: 13,
        DEST_WIDTH: 11
    };

    /**
     * 数字在sprite中的Y定位
     * X定位始终为0
     * @type {Array<number>}
     */
    DistanceMeter.yPos = [0, 13, 27, 40, 53, 67, 80, 93, 107, 120];


    /**
     * 距离测量配置
     * @enum {number}
     */
    DistanceMeter.config = {
        // 位数
        MAX_DISTANCE_UNITS: 5,

        // 成功产生动画的距离。
        ACHIEVEMENT_DISTANCE: 100,

        // 用于将像素距离转换为缩放单位。
        COEFFICIENT: 0.025,

        // flash持续时间（毫秒）。
        FLASH_DURATION: 1000 / 4,

        // 动画的flash迭代
        FLASH_ITERATIONS: 3
    };


    DistanceMeter.prototype = {
        /**
         * 距离初始化为 "00000"
         * @param {number} width Canvas宽度（px）
         */
        init: function (width) {
            var maxDistanceStr = '';

            this.calcXPos(width);
            this.maxScore = this.maxScoreUnits;
            for (var i = 0; i < this.maxScoreUnits; i++) {
                this.draw(i, 0);
                this.defaultString += '0';
                maxDistanceStr += '9';
            }

            this.maxScore = parseInt(maxDistanceStr);
        },

        /**
         * 计算画布中的X定位
         * @param {number} canvasWidth
         */
        calcXPos: function (canvasWidth) {
            this.x = canvasWidth - (DistanceMeter.dimensions.DEST_WIDTH *
                (this.maxScoreUnits + 1));
        },

        /**
         * 在canvas上绘制数字
         * @param {number} digitPos 数字的位置
         * @param {number} value  数字"0-9"
         * @param {boolean} opt_highScore 是否修改最高分
         */
        draw: function (digitPos, value, opt_highScore) {
            var sourceWidth = DistanceMeter.dimensions.WIDTH;
            var sourceHeight = DistanceMeter.dimensions.HEIGHT;
            var sourceX = DistanceMeter.dimensions.WIDTH * value;
            var sourceY = 0;

            var targetX = digitPos * DistanceMeter.dimensions.DEST_WIDTH;
            var targetY = this.y;
            var targetWidth = DistanceMeter.dimensions.WIDTH;
            var targetHeight = DistanceMeter.dimensions.HEIGHT;

            //  对于较高的DPI，我们将值增加为2倍
            if (IS_HIDPI) {
                sourceWidth *= 2;
                sourceHeight *= 2;
                sourceX *= 2;
            }

            sourceX += this.spritePos.x;
            sourceY += this.spritePos.y;

            this.canvasCtx.save();

            if (opt_highScore) {
                // 在当前分数的左侧
                var highScoreX = this.x - (this.maxScoreUnits * 2) *
                    DistanceMeter.dimensions.WIDTH;
                this.canvasCtx.translate(highScoreX, this.y);
            } else {
                this.canvasCtx.translate(this.x, this.y);
            }

            this.canvasCtx.drawImage(this.image, sourceX, sourceY,
                sourceWidth, sourceHeight,
                targetX, targetY,
                targetWidth, targetHeight
            );

            this.canvasCtx.restore();
        },

        /**
         * 将像素距离转换为“真实”距离。
         * @param {number} distance 跑过的像素距离.
         * @return {number} 跑过的真实距离
         */
        getActualDistance: function (distance) {
            return distance ? Math.round(distance * this.config.COEFFICIENT) : 0;
        },

        /**
         * 更新距离测量
         * @param {number} distance
         * @param {number} deltaTime
         * @return {boolean} 是否应播放成功音效
         */
        update: function (deltaTime, distance) {
            var paint = true;
            var playSound = false;

            if (!this.acheivement) {
                distance = this.getActualDistance(distance);
                // 分数已超过初始数字计数.
                if (distance > this.maxScore && this.maxScoreUnits ==
                    this.config.MAX_DISTANCE_UNITS) {
                    this.maxScoreUnits++;
                    this.maxScore = parseInt(this.maxScore + '9');
                } else {
                    this.distance = 0;
                }

                if (distance > 0) {
                    // 成功解锁
                    if (distance % this.config.ACHIEVEMENT_DISTANCE == 0) {
                        // 闪烁分数并播放声音
                        this.acheivement = true;
                        this.flashTimer = 0;
                        playSound = true;
                    }

                    // 创建以0开头的距离的字符串表示形式。
                    var distanceStr = (this.defaultString +
                        distance).substr(-this.maxScoreUnits);
                    this.digits = distanceStr.split('');
                } else {
                    this.digits = this.defaultString.split('');
                }
            } else {
                // 达到目标时控制分数闪烁。
                if (this.flashIterations <= this.config.FLASH_ITERATIONS) {
                    this.flashTimer += deltaTime;

                    if (this.flashTimer < this.config.FLASH_DURATION) {
                        paint = false;
                    } else if (this.flashTimer >
                        this.config.FLASH_DURATION * 2) {
                        this.flashTimer = 0;
                        this.flashIterations++;
                    }
                } else {
                    this.acheivement = false;
                    this.flashIterations = 0;
                    this.flashTimer = 0;
                }
            }

            // 如果不闪烁，则绘制数字。
            if (paint) {
                for (var i = this.digits.length - 1; i >= 0; i--) {
                    this.draw(i, parseInt(this.digits[i]));
                }
            }

            this.drawHighScore();
            return playSound;
        },

        /**
         * 绘制最高分
         */
        drawHighScore: function () {
            this.canvasCtx.save();
            this.canvasCtx.globalAlpha = .8;
            for (var i = this.highScore.length - 1; i >= 0; i--) {
                this.draw(i, parseInt(this.highScore[i], 10), true);
            }
            this.canvasCtx.restore();
        },

        /**
         * 将最高分设置为数组字符串
         * 字符在sprite中的位置: H - 10, I - 11.
         * @param {number} distance Distance ran in pixels.
         */
        setHighScore: function (distance) {
            distance = this.getActualDistance(distance);
            var highScoreStr = (this.defaultString +
                distance).substr(-this.maxScoreUnits);

            this.highScore = ['10', '11', ''].concat(highScoreStr.split(''));
        },

        /**
         * 重置距离为“00000”
         */
        reset: function () {
            this.update(0);
            this.acheivement = false;
        }
    };


    //******************************************************************************

    /**
     * 背景云
     * 类似于障碍物，但没有碰撞框。
     * @param {HTMLCanvasElement} canvas Canvas元素
     * @param {Object} spritePos 图片在sprite中的位置
     * @param {number} containerWidth
     */
    function Cloud(canvas, spritePos, containerWidth) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.spritePos = spritePos;
        this.containerWidth = containerWidth;
        this.xPos = containerWidth;
        this.yPos = 0;
        this.remove = false;
        this.cloudGap = getRandomNum(Cloud.config.MIN_CLOUD_GAP,
            Cloud.config.MAX_CLOUD_GAP);

        this.init();
    };

    /**
     * 云对象的配置
     * @enum {number}
     */
    Cloud.config = {
        HEIGHT: 14,
        MAX_CLOUD_GAP: 400,
        MAX_SKY_LEVEL: 30,
        MIN_CLOUD_GAP: 100,
        MIN_SKY_LEVEL: 71,
        WIDTH: 46
    };

    Cloud.prototype = {
        /**
         * 初始化云。设置云高度
         */
        init: function () {
            this.yPos = getRandomNum(Cloud.config.MAX_SKY_LEVEL,
                Cloud.config.MIN_SKY_LEVEL);
            this.draw();
        },

        /**
         * 绘制云
         */
        draw: function () {
            this.canvasCtx.save();
            var sourceWidth = Cloud.config.WIDTH;
            var sourceHeight = Cloud.config.HEIGHT;

            if (IS_HIDPI) {
                sourceWidth = sourceWidth * 2;
                sourceHeight = sourceHeight * 2;
            }

            this.canvasCtx.drawImage(Runner.imageSprite, this.spritePos.x,
                this.spritePos.y,
                sourceWidth, sourceHeight,
                this.xPos, this.yPos,
                Cloud.config.WIDTH, Cloud.config.HEIGHT);

            this.canvasCtx.restore();
        },

        /**
         * 更新云的位置
         * @param {number} speed
         */
        update: function (speed) {
            if (!this.remove) {
                this.xPos -= Math.ceil(speed);
                this.draw();

                // 如果已经不在canvas中，则标记为可移除
                if (!this.isVisible()) {
                    this.remove = true;
                }
            }
        },

        /**
         * 检查云是否可见了.
         * @return {boolean}
         */
        isVisible: function () {
            return this.xPos + Cloud.config.WIDTH > 0;
        }
    };


    //******************************************************************************

    /**
     * 夜间模式显示地平线上的月亮和星星
     */
    function NightMode(canvas, spritePos, containerWidth) {
        this.spritePos = spritePos;
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.xPos = containerWidth - 50;
        this.yPos = 30;
        this.currentPhase = 0;
        this.opacity = 0;
        this.containerWidth = containerWidth;
        this.stars = [];
        this.drawStars = false;
        this.placeStars();
    };

    /**
     * @enum {number}
     */
    NightMode.config = {
        FADE_SPEED: 0.035,
        HEIGHT: 40,
        MOON_SPEED: 0.25,
        NUM_STARS: 2,
        STAR_SIZE: 9,
        STAR_SPEED: 0.3,
        STAR_MAX_Y: 70,
        WIDTH: 20
    };

    NightMode.phases = [140, 120, 100, 60, 40, 20, 0];

    NightMode.prototype = {
        /**
         * 更新移动的月亮，改变相位。
         * @param {boolean} activated 夜间模式是否激活。
         * @param {number} delta
         */
        update: function (activated, delta) {
            // 月亮相位.
            if (activated && this.opacity == 0) {
                this.currentPhase++;

                if (this.currentPhase >= NightMode.phases.length) {
                    this.currentPhase = 0;
                }
            }

            // 淡入淡出
            if (activated && (this.opacity < 1 || this.opacity == 0)) {
                this.opacity += NightMode.config.FADE_SPEED;
            } else if (this.opacity > 0) {
                this.opacity -= NightMode.config.FADE_SPEED;
            }

            // 设置月球定位
            if (this.opacity > 0) {
                this.xPos = this.updateXPos(this.xPos, NightMode.config.MOON_SPEED);

                // 更新星星
                if (this.drawStars) {
                    for (var i = 0; i < NightMode.config.NUM_STARS; i++) {
                        this.stars[i].x = this.updateXPos(this.stars[i].x,
                            NightMode.config.STAR_SPEED);
                    }
                }
                this.draw();
            } else {
                this.opacity = 0;
                this.placeStars();
            }
            this.drawStars = true;
        },

        updateXPos: function (currentPos, speed) {
            if (currentPos < -NightMode.config.WIDTH) {
                currentPos = this.containerWidth;
            } else {
                currentPos -= speed;
            }
            return currentPos;
        },

        draw: function () {
            var moonSourceWidth = this.currentPhase == 3 ? NightMode.config.WIDTH * 2 :
                NightMode.config.WIDTH;
            var moonSourceHeight = NightMode.config.HEIGHT;
            var moonSourceX = this.spritePos.x + NightMode.phases[this.currentPhase];
            var moonOutputWidth = moonSourceWidth;
            var starSize = NightMode.config.STAR_SIZE;
            var starSourceX = Runner.spriteDefinition.LDPI.STAR.x;

            if (IS_HIDPI) {
                moonSourceWidth *= 2;
                moonSourceHeight *= 2;
                moonSourceX = this.spritePos.x +
                    (NightMode.phases[this.currentPhase] * 2);
                starSize *= 2;
                starSourceX = Runner.spriteDefinition.HDPI.STAR.x;
            }

            this.canvasCtx.save();
            this.canvasCtx.globalAlpha = this.opacity;

            // 星星
            if (this.drawStars) {
                for (var i = 0; i < NightMode.config.NUM_STARS; i++) {
                    this.canvasCtx.drawImage(Runner.imageSprite,
                        starSourceX, this.stars[i].sourceY, starSize, starSize,
                        Math.round(this.stars[i].x), this.stars[i].y,
                        NightMode.config.STAR_SIZE, NightMode.config.STAR_SIZE);
                }
            }

            // 月亮
            this.canvasCtx.drawImage(Runner.imageSprite, moonSourceX,
                this.spritePos.y, moonSourceWidth, moonSourceHeight,
                Math.round(this.xPos), this.yPos,
                moonOutputWidth, NightMode.config.HEIGHT);

            this.canvasCtx.globalAlpha = 1;
            this.canvasCtx.restore();
        },

        // 做星星定位。
        placeStars: function () {
            var segmentSize = Math.round(this.containerWidth /
                NightMode.config.NUM_STARS);

            for (var i = 0; i < NightMode.config.NUM_STARS; i++) {
                this.stars[i] = {};
                this.stars[i].x = getRandomNum(segmentSize * i, segmentSize * (i + 1));
                this.stars[i].y = getRandomNum(0, NightMode.config.STAR_MAX_Y);

                if (IS_HIDPI) {
                    this.stars[i].sourceY = Runner.spriteDefinition.HDPI.STAR.y +
                        NightMode.config.STAR_SIZE * 2 * i;
                } else {
                    this.stars[i].sourceY = Runner.spriteDefinition.LDPI.STAR.y +
                        NightMode.config.STAR_SIZE * i;
                }
            }
        },

        reset: function () {
            this.currentPhase = 0;
            this.opacity = 0;
            this.update(false);
        }

    };


    //******************************************************************************

    /**
     * 地平线
     * 由两条连接线组成。随机指定平坦/崎岖的地平线。
     * @param {HTMLCanvasElement} canvas
     * @param {Object} spritePos 在sprite中地平线
     * @constructor
     */
    function HorizonLine(canvas, spritePos) {
        this.spritePos = spritePos;
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.sourceDimensions = {};
        this.dimensions = HorizonLine.dimensions;
        this.sourceXPos = [this.spritePos.x, this.spritePos.x +
            this.dimensions.WIDTH];
        this.xPos = [];
        this.yPos = 0;
        this.bumpThreshold = 0.5;

        this.setSourceDimensions();
        this.draw();
    };


    /**
     * 地平线尺寸
     * @enum {number}
     */
    HorizonLine.dimensions = {
        WIDTH: 600,
        HEIGHT: 12,
        YPOS: 127
    };


    HorizonLine.prototype = {
        /**
         * 设置地平线的源尺寸
         */
        setSourceDimensions: function () {

            for (var dimension in HorizonLine.dimensions) {
                if (IS_HIDPI) {
                    if (dimension != 'YPOS') {
                        this.sourceDimensions[dimension] =
                            HorizonLine.dimensions[dimension] * 2;
                    }
                } else {
                    this.sourceDimensions[dimension] =
                        HorizonLine.dimensions[dimension];
                }
                this.dimensions[dimension] = HorizonLine.dimensions[dimension];
            }

            this.xPos = [0, HorizonLine.dimensions.WIDTH];
            this.yPos = HorizonLine.dimensions.YPOS;
        },

        /**
         * 返回类型的x位置。
         */
        getRandomType: function () {
            return Math.random() > this.bumpThreshold ? this.dimensions.WIDTH : 0;
        },

        /**
         * 绘制地平线
         */
        draw: function () {
            this.canvasCtx.drawImage(Runner.imageSprite, this.sourceXPos[0],
                this.spritePos.y,
                this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT,
                this.xPos[0], this.yPos,
                this.dimensions.WIDTH, this.dimensions.HEIGHT);

            this.canvasCtx.drawImage(Runner.imageSprite, this.sourceXPos[1],
                this.spritePos.y,
                this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT,
                this.xPos[1], this.yPos,
                this.dimensions.WIDTH, this.dimensions.HEIGHT);
        },

        /**
         * 更新线的单个部分的x位置。
         * @param {number} pos 线定位
         * @param {number} increment
         */
        updateXPos: function (pos, increment) {
            var line1 = pos;
            var line2 = pos == 0 ? 1 : 0;

            this.xPos[line1] -= increment;
            this.xPos[line2] = this.xPos[line1] + this.dimensions.WIDTH;

            if (this.xPos[line1] <= -this.dimensions.WIDTH) {
                this.xPos[line1] += this.dimensions.WIDTH * 2;
                this.xPos[line2] = this.xPos[line1] - this.dimensions.WIDTH;
                this.sourceXPos[line1] = this.getRandomType() + this.spritePos.x;
            }
        },

        /**
         * 更新地平线
         * @param {number} deltaTime
         * @param {number} speed
         */
        update: function (deltaTime, speed) {
            var increment = Math.floor(speed * (FPS / 1000) * deltaTime);

            if (this.xPos[0] <= 0) {
                this.updateXPos(0, increment);
            } else {
                this.updateXPos(1, increment);
            }
            this.draw();
        },

        /**
         * 将地平线重置为起始位置
         */
        reset: function () {
            this.xPos[0] = 0;
            this.xPos[1] = HorizonLine.dimensions.WIDTH;
        }
    };

    //******************************************************************************

    /**
     * 地平线背景类
     * @param {HTMLCanvasElement} canvas0p -p
     * @param {Object} spritePos Sprite 位置
     * @param {Object} dimensions Canvas 尺寸
     * @param {number} gapCoefficient
     * @constructor
     */
    function Horizon(canvas, spritePos, dimensions, gapCoefficient) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.config = Horizon.config;
        this.dimensions = dimensions;
        this.gapCoefficient = gapCoefficient;
        this.obstacles = [];
        this.obstacleHistory = [];
        this.horizonOffsets = [0, 0];
        this.cloudFrequency = this.config.CLOUD_FREQUENCY;
        this.spritePos = spritePos;
        this.nightMode = null;

        // 云
        this.clouds = [];
        this.cloudSpeed = this.config.BG_CLOUD_SPEED;

        // 地平线
        this.horizonLine = null;
        this.init();
    };


    /**
     * 地平线配置
     * @enum {number}
     */
    Horizon.config = {
        BG_CLOUD_SPEED: 0.2,
        BUMPY_THRESHOLD: .3,
        CLOUD_FREQUENCY: .5,
        HORIZON_HEIGHT: 16,
        MAX_CLOUDS: 6
    };

    Horizon.prototype = {
        /**
         * 初始化地平线。只需添加线条和云。没有障碍。
         */
        init: function () {
            this.addCloud();
            this.horizonLine = new HorizonLine(this.canvas, this.spritePos.HORIZON);
            this.nightMode = new NightMode(this.canvas, this.spritePos.MOON,
                this.dimensions.WIDTH);
        },

        /**
         * @param {number} deltaTime
         * @param {number} currentSpeed
         * @param {boolean} updateObstacles 用作覆盖以防止更新/添加障碍物
         * 这发生在ease in部分。
         * @param {boolean} showNightMode 夜间模式激活状态
         */
        update: function (deltaTime, currentSpeed, updateObstacles, showNightMode) {
            this.runningTime += deltaTime;
            this.horizonLine.update(deltaTime, currentSpeed);
            this.nightMode.update(showNightMode);
            this.updateClouds(deltaTime, currentSpeed);

            if (updateObstacles) {
                this.updateObstacles(deltaTime, currentSpeed);
            }
        },

        /**
         * 更新云定位
         * @param {number} deltaTime
         * @param {number} currentSpeed
         */
        updateClouds: function (deltaTime, speed) {
            var cloudSpeed = this.cloudSpeed / 1000 * deltaTime * speed;
            var numClouds = this.clouds.length;

            if (numClouds) {
                for (var i = numClouds - 1; i >= 0; i--) {
                    this.clouds[i].update(cloudSpeed);
                }

                var lastCloud = this.clouds[numClouds - 1];

                // 检查是否添加新云
                if (numClouds < this.config.MAX_CLOUDS &&
                    (this.dimensions.WIDTH - lastCloud.xPos) > lastCloud.cloudGap &&
                    this.cloudFrequency > Math.random()) {
                    this.addCloud();
                }

                // 删除过期的云
                this.clouds = this.clouds.filter(function (obj) {
                    return !obj.remove;
                });
            } else {
                this.addCloud();
            }
        },

        /**
         * 更新障碍物位置。
         * @param {number} deltaTime
         * @param {number} currentSpeed
         */
        updateObstacles: function (deltaTime, currentSpeed) {
            // 障碍物，移动到地平线层。
            var updatedObstacles = this.obstacles.slice(0);

            for (var i = 0; i < this.obstacles.length; i++) {
                var obstacle = this.obstacles[i];
                obstacle.update(deltaTime, currentSpeed);

                // 清除已存在的障碍
                if (obstacle.remove) {
                    updatedObstacles.shift();
                }
            }
            this.obstacles = updatedObstacles;

            if (this.obstacles.length > 0) {
                var lastObstacle = this.obstacles[this.obstacles.length - 1];

                if (lastObstacle && !lastObstacle.followingObstacleCreated &&
                    lastObstacle.isVisible() &&
                    (lastObstacle.xPos + lastObstacle.width + lastObstacle.gap) <
                    this.dimensions.WIDTH) {
                    this.addNewObstacle(currentSpeed);
                    lastObstacle.followingObstacleCreated = true;
                }
            } else {
                // 创建新的障碍
                this.addNewObstacle(currentSpeed);
            }
        },

        removeFirstObstacle: function () {
            this.obstacles.shift();
        },
    
        /**
         * 添加新障碍
         * @param {number} currentSpeed
         */
        addNewObstacle: function (currentSpeed) {
            var obstacleTypeIndex = getRandomNum(0, Obstacle.types.length - 1);
            var obstacleType = Obstacle.types[obstacleTypeIndex];

            // 检查同一类型障碍物的倍数。
            // 同时检查障碍物在当前速度下是否可用。
            if (this.duplicateObstacleCheck(obstacleType.type) ||
                currentSpeed < obstacleType.minSpeed) {
                this.addNewObstacle(currentSpeed);
            } else {
                var obstacleSpritePos = this.spritePos[obstacleType.type];

                this.obstacles.push(new Obstacle(this.canvasCtx, obstacleType,
                    obstacleSpritePos, this.dimensions,
                    this.gapCoefficient, currentSpeed, obstacleType.width));

                this.obstacleHistory.unshift(obstacleType.type);

                if (this.obstacleHistory.length > 1) {
                    this.obstacleHistory.splice(Runner.config.MAX_OBSTACLE_DUPLICATION);
                }
            }
        },

        /**
         * 返回前两个障碍是否与下一个相同。
         * 最大重复在配置值MAX_OBSTACLE_DUPLICATION中设置。
         * @return {boolean}
         */
        duplicateObstacleCheck: function (nextObstacleType) {
            var duplicateCount = 0;

            for (var i = 0; i < this.obstacleHistory.length; i++) {
                duplicateCount = this.obstacleHistory[i] == nextObstacleType ?
                    duplicateCount + 1 : 0;
            }
            return duplicateCount >= Runner.config.MAX_OBSTACLE_DUPLICATION;
        },

        /**
         * 重置地平线层。
         * 移除现有障碍物并重新定位地平线
         */
        reset: function () {
            this.obstacles = [];
            this.horizonLine.reset();
            this.nightMode.reset();
        },

        /**
         * 更新canvas宽度和比例
         * @param {number} width Canvas宽度
         * @param {number} height Canvas高度
         */
        resize: function (width, height) {
            this.canvas.width = width;
            this.canvas.height = height;
        },

        /**
         * 添加新云
         */
        addCloud: function () {
            this.clouds.push(new Cloud(this.canvas, this.spritePos.CLOUD,
                this.dimensions.WIDTH));
        }
    };
})();


function onDocumentLoad() {
    new Runner('.interstitial-wrapper');
}

document.addEventListener('DOMContentLoaded', onDocumentLoad);
