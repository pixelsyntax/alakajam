/* eslint-env jquery */

module.exports = function viewEntryVoting () {
  const $stars = $('.js-star')
  const $starsArray = []
  $stars.each(function () {
    $starsArray.push($(this))
  })

  $stars.mouseenter(function () {
    const $this = $(this)
    const category = $this.attr('data-category')
    const rating = parseInt($this.attr('data-rating'))
    setCurrentCategory(category)
    setRating(category, rating, false)
  })

  $stars.mouseleave(function () {
    setCurrentCategory(null)
  })

  $stars.click(function () {
    const $this = $(this)
    const category = $this.attr('data-category')
    const rating = parseInt($this.attr('data-rating'))
    setRating(category, rating, true)

    const $form = $this.closest('form')
    const $errorText = $form.find('.js-saving-error-text')
    saveRatings($form, $errorText)
  })

  let currentCategory = null

  function setCurrentCategory (category) {
    if (currentCategory !== category) {
      if (currentCategory !== null) {
        const confirmedRating = parseInt($('#js-vote-' + currentCategory).val() || 0)
        setRating(currentCategory, confirmedRating, true)
      }
      currentCategory = category
    }
  }

  function setRating (category, rating, confirmed) {
    $starsArray.forEach(function ($star) {
      if ($star.attr('data-category') === category) {
        const starRating = parseInt($star.attr('data-rating'))
        if ((starRating !== 0 && starRating > rating) ||
            (starRating === 0 && rating !== 0)) {
          if ($star.hasClass('fa-star')) {
            $star.removeClass('fas')
            $star.addClass('far')
          }
          $star.removeClass('confirmed')
        } else {
          if ($star.hasClass('fa-star')) {
            $star.removeClass('far')
            $star.addClass('fas')
          }
          $star.toggleClass('confirmed', confirmed)
        }
      }
    })

    const $ratingLabel = $('#js-vote-label-' + category)
    $ratingLabel.text(rating !== 0 ? rating : '\xa0') // &nbsp;
    if (confirmed) {
      const previousValue = $('#js-vote-' + category).val()
      const newValue = rating.toFixed(3)

      $ratingLabel.addClass('confirmed')
      if (previousValue !== newValue) {
        $('#js-vote-' + category).val(newValue)
      }
    } else {
      $ratingLabel.removeClass('confirmed')
    }
  }

  // Allow only one in-flight POST request at a time to prevent any race conditions.
  let posting = false
  let postQueue = []

  function saveRatings ($form, $errorText) {
    const postObj = {
      url: $form.attr('action') || '',
      data: $form.serialize(),
      beforeSend: function (jqXHR, settings) {
        $form.removeClass('form-saving-success')
        $form.removeClass('form-saving-error')
        $form.addClass('form-saving')
        posting = true
      },
      success: function (data, textStatus, jqXHR) {
        $form.addClass('form-saving-success')
        $errorText.empty()
      },
      error: function (jqXHR, textStatus, errorThrown) {
        $form.addClass('form-saving-error')
        $errorText.text(`Failed to save ratings: ${errorThrown || textStatus}. Enter another rating to retry.`)
      },
      complete: function (jqXHR, textStatus) {
        $form.removeClass('form-saving')
        posting = false
        if (postQueue.length > 0) {
          $.post(postQueue.shift())
        }
      }
    }
    if (posting) {
      postQueue.push(postObj)
    } else {
      $.post(postObj)
    }
  }
}
