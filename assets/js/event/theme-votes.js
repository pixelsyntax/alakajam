/* eslint-env jquery */
/* global _ */

module.exports = function themeVotes () {
  const $themeVote = $('#js-theme-vote')
  if ($themeVote.length === 0) {
    return
  }
  const $userVotes = $('#js-user-votes')
  const $totalVotes = $('#js-total-votes')
  const $themeHistory = $('#js-theme-history')

  const voteFormSelector = '#js-vote-form'
  const upvoteSelector = '#js-upvote'
  const downvoteSelector = '#js-downvote'
  const themeIdSelector = '#js-theme-id'
  const themeTitleSelector = '#js-theme-title'
  const themeVoteHistoryBlockSelector = '.js-theme-vote-history-block'

  const themeVoteTemplate = _.template($('#js-theme-vote-template').html())
  const themeVoteHistoryTemplate = _.template($('#js-theme-vote-history-template').html())

  const findThemesUrl = $themeVote.attr('data-find-themes-url')
  const saveVoteUrl = $themeVote.attr('data-save-vote-url')

  let themeBuffer = []
  let refreshInterval = null

  $(document).on('submit', voteFormSelector, function (e) {
    e.preventDefault()
  })

  $(document).on('click', upvoteSelector, function (e) {
    onVoteClick(true)
    e.preventDefault()
  })

  $(document).on('click', downvoteSelector, function (e) {
    onVoteClick(false)
    e.preventDefault()
  })

  function nextTheme () {
    if (themeBuffer.length === 0) {
      $.getJSON(findThemesUrl, function (data) {
        themeBuffer = data
        renderTheme(themeBuffer.length > 0 ? themeBuffer.shift() : null)
      })
    } else {
      renderTheme(themeBuffer.shift())
    }
  }

  function renderTheme (themeInfo) {
    $themeVote.html(themeVoteTemplate({ theme: themeInfo }))
    $themeVote.fadeIn(300)

    if (!themeInfo) {
      if (!refreshInterval) {
        refreshInterval = setInterval(nextTheme, 5 * 60000)
      }
    } else if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }

  function onVoteClick (upvote) {
    if (themeBuffer.length > 0) {
      // Don't wait for save to make the next theme show fast
      saveVote($(themeIdSelector).val(), upvote)
      nextTheme()
    } else {
      saveVote($(themeIdSelector).val(), upvote, nextTheme)
    }
    $userVotes.text(parseInt($userVotes.text()) + 1)
    $totalVotes.text(parseInt($totalVotes.text()) + 1)
  }

  function saveVote (id, upvote, callback) {
    $themeVote.hide()

    var themeInfo = {
      id: id,
      title: $(themeTitleSelector).text()
    }
    if (upvote) {
      themeInfo.upvote = true
    } else {
      themeInfo.downvote = true
    }

    var historyBlock = themeVoteHistoryTemplate({ theme: themeInfo })
    $themeHistory.prepend(historyBlock)
    $(themeVoteHistoryBlockSelector).fadeIn(800)

    $.post(saveVoteUrl, themeInfo, callback)
  }

  nextTheme()
}
