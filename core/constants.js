'use strict'

/**
 * Constants
 *
 * @module core/constants
 */

const PERMISSION_READ = 'read'
const PERMISSION_WRITE = 'write'
const PERMISSION_MANAGE = 'manage'
const ORDERED_PERMISSIONS = [PERMISSION_READ, PERMISSION_WRITE, PERMISSION_MANAGE]

const SPECIAL_POST_TYPE_ANNOUNCEMENT = 'announcement'
const SPECIAL_POST_TYPE_ARTICLE = 'article'
const SPECIAL_POST_TYPES = [SPECIAL_POST_TYPE_ANNOUNCEMENT, SPECIAL_POST_TYPE_ARTICLE]

module.exports = {
  // Settings
  SETTING_SESSION_KEY: 'session_key',
  SETTING_INVITE_PASSWORD: 'invite_password',
  SETTING_INVITE_PEPPER: 'invite_pepper',

  // Security
  PERMISSION_READ,
  PERMISSION_WRITE,
  PERMISSION_MANAGE,
  ORDERED_PERMISSIONS,

  // Posts
  SPECIAL_POST_TYPE_ANNOUNCEMENT,
  SPECIAL_POST_TYPE_ARTICLE,
  SPECIAL_POST_TYPES,
  REQUIRED_ARTICLES: ['help'],
  ALLOWED_POST_TAGS: [ 'b', 'i', 'em', 'strong', 'a', 'u', 'br', 'iframe' ],
  ALLOWED_POST_ATTRIBUTES: {
    'a': ['href'],
    'iframe': ['src', 'width', 'height', 'frameborder', 'webkitallowfullscreen', 'mozallowfullscreen', 'allowfullscreen']
  },
  ALLOWED_IFRAME_HOSTS: ['player.vimeo.com', 'www.youtube.com'],

  // Dates
  DATE_FORMAT: 'MMMM Do YYYY',
  DATE_TIME_FORMAT: 'MMMM Do YYYY, h:mm',
  PICKER_DATE_TIME_FORMAT: 'YYYY-MM-DD HH:mm',
  PICKER_CLIENT_DATE_TIME_FORMAT: 'yyyy-mm-dd hh:ii'

}
