'use strict'

/**
 * Server middleware configuration.
 *
 * @description Sets up:
 * - Static file serving (CSS/JS/images)
 * - Templating (nunjucks)
 * - Form parsing / file upload (formidable)
 * - Error pages
 *
 * @module core/middleware
 */

const path = require('path')
const express = require('express')
const expressNunjucks = require('express-nunjucks')
const expressSession = require('express-session')
const cookies = require('cookies')
const bodyParser = require('body-parser')
const moment = require('moment')
const nunjucks = require('nunjucks')
const randomKey = require('random-key')
const leftPad = require('left-pad')
const log = require('./log')
const config = require('../config')
const constants = require('../core/constants')
const fileStorage = require('../core/file-storage')
const forms = require('../core/forms')
const enums = require('../core/enums')
const settingService = require('../services/setting-service')
const sessionService = require('../services/session-service')
const userService = require('../services/user-service')
const controllers = require('../controllers/index')
const templating = require('../controllers/templating')

const ROOT_PATH = path.join(__dirname, '..')
const LAUNCH_TIME = new Date().getTime()

module.exports = {
  configure
}

/*
 * Setup app middleware
 */
async function configure (app) {
  app.locals.config = config

  // Slow requests logging
  if (config.DEBUG_TRACE_SLOW_REQUESTS > -1) {
    app.use(function (req, res, next) {
      let start = Date.now()
      res.once('finish', () => {
        let totalTime = Date.now() - start
        if (totalTime > config.DEBUG_TRACE_SLOW_REQUESTS) {
          log.debug(req.url + ' ' + totalTime + 'ms')
        }
      })
      next()
    })
  }

  // In-memory data
  await userService.loadPasswordRecoveryCache(app)
  await sessionService.loadSessionCache(app)

  // Session management
  let sessionKey = await findOrCreateSessionKey()
  app.use(cookies.express([sessionKey]))
  app.use(expressSession({
    secret: randomKey.generate(),
    resave: false,
    saveUninitialized: false
  }))

  // Static files
  app.use('/static', express.static(path.join(ROOT_PATH, '/static')))

  // Templating
  app.set('views', path.join(ROOT_PATH, '/templates'))
  let nj = expressNunjucks(app, {
    watch: app.locals.devMode,
    noCache: app.locals.devMode
  })

  // Templating: custom filters
  nj.env.addGlobal('browserRefreshUrl', process.env.BROWSER_REFRESH_URL)
  nj.env.addGlobal('constants', constants)
  nj.env.addGlobal('enums', enums)
  nj.env.addGlobal('devMode', app.locals.devMode)
  nj.env.addGlobal('launchTime', LAUNCH_TIME)
  nj.env.addGlobal('context', function () {
    // lets devs display the whole templating context with
    // {{ context() | prettyDump | safe }}
    this.ctx.constants = constants
    this.ctx.enums = enums
    this.ctx.devMode = app.locals.devMode
    this.ctx.launchTime = LAUNCH_TIME
    return this.ctx
  })
  for (var functionName in templating) {
    nj.env.addGlobal(functionName, templating[functionName])
  }

  nj.env.addFilter('keys', function (obj) {
    return Object.keys(obj)
  })
  nj.env.addFilter('values', function (obj) {
    return Object.values(obj)
  })
  nj.env.addFilter('pretty', function (obj) {
    return JSON.stringify(obj, null, 2)
  })
  nj.env.addFilter('prettyDump', function (obj) {
    return '<pre>' + JSON.stringify(obj, null, 2) + '</pre>'
  })
  nj.env.addFilter('markdown', function (str) {
    return forms.markdownToHtml(str)
  })
  nj.env.addFilter('markdownUnescape', function (str) {
    return str ? str.replace(/&amp;/g, '&').replace(/&quot;/g, '"') : null
  })
  nj.env.addFilter('date', function (date, format) {
    if (date) {
      return moment(date).utc().format(format || constants.DATE_FORMAT)
    } else {
      return ''
    }
  })
  nj.env.addFilter('dateTime', function (date) {
    if (date) {
      return moment(date).utc().format(constants.DATE_TIME_FORMAT)
    } else {
      return ''
    }
  })
  nj.env.addFilter('featuredEventDateTime', function (date) {
    if (date) {
      return moment(date).utc().format(constants.FEATURED_EVENT_DATE_FORMAT) + ' UTC'
    } else {
      return ''
    }
  })
  nj.env.addFilter('relativeTime', function (date) {
    return moment(date).utc().fromNow()
  })
  nj.env.addFilter('duration', function (durationInSeconds) {
    let minutes = Math.floor(durationInSeconds / 60)
    let seconds = durationInSeconds - minutes * 60
    return minutes + "'" + leftPad(seconds.toFixed(3).replace('.', '"'), 6, '0')
  })
  nj.env.addFilter('ordinal', function (n) {
    // source: https://stackoverflow.com/a/12487454
    let s = ['th', 'st', 'nd', 'rd']
    let v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  })
  nj.env.addFilter('digits', function (number, digits) {
    if (typeof number === 'string') {
      number = parseFloat(number)
    }
    if (typeof number === 'number') {
      return number.toFixed(digits)
    } else {
      return null
    }
  })
  nj.env.addFilter('leftpad', function (number, toLength, char) {
    return number ? leftPad(number, toLength, char) : ''
  })
  nj.env.addFilter('paginationBasePath', function (path) {
    let basePath = path.replace(/[?&]p=[^&]*/g, '')
    if (!basePath.includes('?')) {
      basePath += '?'
    }
    return basePath
  })
  /**
   * Returns a JSON stringified version of the value, safe for inclusion in an
   * inline <script> tag. The optional argument 'spaces' can be used for
   * pretty-printing.
   *
   * Output is NOT safe for inclusion in HTML! If that's what you need, use the
   * built-in 'dump' filter instead.
   */
  nj.env.addFilter('jsonInsideScriptTag', function (value, spaces) {
    if (value instanceof nunjucks.runtime.SafeString) {
      value = value.toString()
    }
    const jsonString = JSON.stringify(value, null, spaces).replace(/</g, '\\u003c')
    return nunjucks.runtime.markSafe(jsonString)
  })

  // Body parsers config
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(async function (req, res, next) {
    // Multer auto cleanup (actual Multer middleware is declared at initUploadMiddleware())
    res.on('finish', cleanupFormFilesCallback(req, res))
    res.on('close', cleanupFormFilesCallback(req, res))
    next()
  })

  // Templating: rendering context
  app.use(function templateTooling (req, res, next) {
    // Allow anyone to display an error page
    res.errorPage = (code, message) => errorPage(req, res, code, message, app.locals.devMode)

    // Context made available anywhere
    let nativeRender = res.render
    res.render = function (template, context) {
      let mergedContext = Object.assign({
        rootUrl: config.ROOT_URL,
        csrfToken: () => '<input type="hidden" name="_csrf" value="' + req.csrfToken() + '" />'
      }, res.locals, context)
      nativeRender.call(res, template, mergedContext)
      res.rendered = true
    }

    next()
  })

  // Routing: Views
  controllers.initRoutes(app)

  // Routing: 500/404
  app.use(function notFound (req, res) {
    errorPage(req, res, 404, undefined, app.locals.devMode)
  })
  app.use(function error (error, req, res, next) {
    if (error.code === 'EBADCSRFTOKEN') {
      // Redirect to the GET method of the form
      log.warn('Invalid CSRF token, redirecting to GET form')
      res.redirect(req.url)
    } else if (error.code === 'LIMIT_FILE_SIZE') {
      console.log(error)
      errorPage(req, res, 400, 'Attachment is too large, please go back and check the size limit', app.locals.devMode)
    } else {
      errorPage(req, res, 500, error, app.locals.devMode)
    }
  })
}

function cleanupFormFilesCallback (req, res) {
  return async function cleanupFormFiles () {
    if (res.locals.form) {
      for (let key in res.locals.form.files) {
        let fileInfo = res.locals.form.files[key]
        if (fileInfo) {
          if (Array.isArray(fileInfo)) {
            for (let fileInfoEntry of fileInfo) {
              fileStorage.remove(fileInfoEntry.path)
            }
          } else {
            fileStorage.remove(fileInfo.path)
          }
        }
      }
    }
    res.removeAllListeners('finish')
    res.removeAllListeners('close')
  }
}

async function findOrCreateSessionKey () {
  let sessionKey = await settingService.find(constants.SETTING_SESSION_KEY)
  if (!sessionKey) {
    sessionKey = randomKey.generate()
    await settingService.save(constants.SETTING_SESSION_KEY, sessionKey)
  }
  return sessionKey
}

/*
 * Middleware displaying an error page
 * code = HTTP error code
 * error = Error object or string message (optional)
 */
function errorPage (req, res, code, error, devMode) {
  const stack = devMode ? error && error.stack : undefined
  let message = (typeof error === 'object') ? error.message : error
  let title
  switch (code) {
    case 404:
      title = 'Page not found'
      break
    case 403:
      title = 'Forbidden'
      break
    case 500:
      title = 'Internal error'
      if (!devMode) {
        message = 'Something went wrong, sorry about that.'
      }
      break
    default:
      title = 'Error'
  }

  // Internal error logging
  if (code !== 404 && code !== 403) {
    log.error(`HTTP ${code}: ${message}` + (error ? '\n' + error.stack : ''))
  }

  // Page rendering
  res.status(code)
  res.render('error', {
    code,
    title,
    message,
    stack,
    path: req.originalUrl // Needed by _page.html, normally added by anyPageMiddleware
  })
}
