/**
 * SysLog Dashboard Configuration
 * 
 * Customize your dashboard behavior by modifying these settings.
 * After making changes, refresh your browser to see the updates.
 */

const SYSLOG_CONFIG = {
  // ===== FEED SETTINGS =====
  
  /**
   * Number of news items to load per scroll batch
   * Lower = faster scrolling, more frequent loads
   * Higher = fewer loads, but slower initial render
   * Recommended: 15-30
   */
  BATCH_SIZE: 20,

  /**
   * Auto-refresh interval in milliseconds
   * Default: 5 minutes (300000ms)
   * Set to 0 to disable auto-refresh
   */
  AUTO_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes

  /**
   * Cache time-to-live in milliseconds
   * How long cached data remains valid for offline use
   * Default: 30 minutes (1800000ms)
   */
  CACHE_TTL: 30 * 60 * 1000, // 30 minutes

  /**
   * Retry delays for failed requests (in milliseconds)
   * Exponential backoff: [1s, 2s, 4s]
   * After all retries fail, shows error message
   */
  RETRY_DELAYS: [1000, 2000, 4000],

  // ===== TICKER SETTINGS =====

  /**
   * Ticker animation speed in seconds
   * Lower = faster scrolling
   * Higher = slower, more readable
   * Default: 900 seconds for full loop
   */
  TICKER_SPEED: 900,

  /**
   * Filter out gambling-related sports content
   * Set to false to show all sports content
   */
  FILTER_GAMBLING: true,

  /**
   * Sports categories to show in ticker
   * Available: 'nba', 'nfl', 'mlb', 'nhl', 'soccer'
   */
  SPORTS_CATEGORIES: ['nba', 'nfl', 'mlb', 'nhl', 'soccer'],

  // ===== UI SETTINGS =====

  /**
   * Show keyboard shortcuts hint on page load
   * Hint automatically disappears after 5 seconds
   */
  SHOW_SHORTCUTS_HINT: true,

  /**
   * Delay before showing shortcuts hint (milliseconds)
   */
  SHORTCUTS_HINT_DELAY: 2000,

  /**
   * Enable smooth scrolling animations
   */
  SMOOTH_SCROLL: true,

  /**
   * Show skeleton loading screens
   * Set to false for instant content display
   */
  SHOW_SKELETON_LOADING: true,

  /**
   * Number of skeleton cards to show while loading
   */
  SKELETON_CARD_COUNT: 6,

  // ===== KEYBOARD SHORTCUTS =====

  /**
   * Enable keyboard shortcuts
   * R = Refresh
   * Ctrl+↑/↓ = Scroll
   * Esc = Close weather
   * ? = Show shortcuts
   */
  ENABLE_KEYBOARD_SHORTCUTS: true,

  /**
   * Scroll distance for Ctrl+Arrow keys (pixels)
   */
  KEYBOARD_SCROLL_DISTANCE: 300,

  // ===== WEATHER SETTINGS =====

  /**
   * Temperature unit
   * Options: 'fahrenheit' or 'celsius'
   */
  TEMPERATURE_UNIT: 'fahrenheit',

  // ===== ADVANCED SETTINGS =====

  /**
   * Enable localStorage caching
   * Allows offline viewing of previously loaded content
   */
  ENABLE_CACHE: true,

  /**
   * Enable retry mechanism for failed requests
   */
  ENABLE_RETRY: true,

  /**
   * Maximum number of items to display in feed
   * Set to 0 for unlimited (loads all available items)
   */
  MAX_FEED_ITEMS: 0,

  /**
   * Debug mode - logs additional information to console
   */
  DEBUG_MODE: false,
};

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SYSLOG_CONFIG;
}

// Made with Bob
