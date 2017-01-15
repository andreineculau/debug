/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

var isFirefox = false;
var isFirefoxNewerThan31 = false;
var isAppleWebkit = false;

if (typeof navigator !== 'undefined' &&
    typeof navigator.userAgent !== 'undefined') {
  isFirefox = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)
  isFirefoxNewerThan31 = isFirefox && parseInt(RegExp.$1, 10) >= 31;
  isAppleWebkit = navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/)
}

exports.storage = (function() {
  var browser = window.browser || window.chrome;

  if (typeof browser !== 'undefined' &&
      typeof browser.storage !== 'undefined' &&
      typeof browser.storage.local !== 'undefined') {

    // maintain compatibility with localStorage
    return {
      get: function(key, cb) {
        var cbProxy = function(items) {
          cb(items[key]);
        };

        if (isFirefox) {
          // Firefox uses the Promise pattern
          browser.storage.local.get(key).then(cbProxy);
        } else {
          // Chrome/Opera/Edge use the callback pattern
          browser.storage.local.get(key, cbProxy);
        }
      },

      set: function(key, value) {
        var items = {};
        items[key] = value;
        browser.storage.local.set(items);
      },

      remove: browser.storage.local.remove
    };
  }

  if (window.localStorage) {
    return {
      get: function(key, cb) {
        var value = window.localStorage.getItem(key);
        cb(value);
      },
      set: function(key, value) {
        window.localStorage.setItem(key, value);
      },
      remove: function(key) {
        window.localStorage.removeItem(key);
      }
    };
  }
})();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window && typeof window.process !== 'undefined' && window.process.type === 'renderer') {
    return true;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document && 'WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window && window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (isFirefoxNewerThan31) ||
    // double check webkit in userAgent just in case we are in a worker
    (isAppleWebkit)
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  if (null == namespaces) {
    exports.storage.remove('debug');
  } else {
    exports.storage.set('debug', namespaces);
  }
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  if (exports.storage) {
    exports.storage.get('debug', exports.enable);
  } else {
    if (typeof process !== 'undefined' &&
        typeof process.env !== 'undefined' &&
        typeof process.env.DEBUG !== 'undefined') {
      exports.enable(process.env.DEBUG);
    }
  }
}

/**
 * Enable namespaces listed in the storage `debug`` initially.
 */

exports.load();
