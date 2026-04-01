(function() {
    var url = window.location.href;
    var pageText = document.body.innerText;

    function extractVideoDetail() {
      var videoIdMatch = url.match(/\/video\/(\d+)/);
      var videoId = videoIdMatch ? videoIdMatch[1] : '';

      var title = '';
      var hashtags = [];

      var peopleIndex = pageText.indexOf('@人民网');
      if (peopleIndex > 0) {
        var beforePeople = pageText.substring(0, peopleIndex);
        var lastNewline = Math.max(beforePeople.lastIndexOf(String.fromCharCode(10)), beforePeople.lastIndexOf(String.fromCharCode(13)));
        var firstNewline = beforePeople.indexOf(String.fromCharCode(10), lastNewline + 1);
        if (firstNewline === -1) firstNewline = beforePeople.indexOf(String.fromCharCode(13), lastNewline + 1);
        if (firstNewline === -1) firstNewline = 0;
        var titleCandidate = beforePeople.substring(firstNewline).trim();
        if (titleCandidate.indexOf('#') >= 0) {
          title = titleCandidate;
        }
      }

      var tagMatches = pageText.match(/#[^#\s]+/g);
      if (tagMatches) {
        hashtags = tagMatches.slice(0, 5);
      }

      var author = '';
      var authorMatch = pageText.match(/([\u4e00-\u9fa5·]+)[·\s]*(粉丝|获赞)/);
      if (authorMatch) author = authorMatch[1];

      var stats = {};
      var peopleIdx = pageText.indexOf('@人民网');
      if (peopleIdx >= 0) {
        var afterPeople = pageText.substring(peopleIdx + 4);
        var numbers = [];
        var numRegex = /\d+\.?\d*[万亿]?/g;
        var match;
        while ((match = numRegex.exec(afterPeople)) !== null && numbers.length < 4) {
          numbers.push(match[0]);
        }
        if (numbers.length >= 4) {
          stats.likeCount = numbers[0];
          stats.commentCount = numbers[1];
          stats.collectCount = numbers[2];
          stats.shareCount = numbers[3];
        }
      }

      var publishTime = '';
      var timeMatch = pageText.match(/发布时间[：:]\s*(\d{4}-\d{2}-\d{2}[\s\d:]*)/);
      if (timeMatch) publishTime = timeMatch[1].trim();

      return {
        videoId: videoId,
        url: url,
        title: title,
        hashtags: hashtags,
        author: author,
        authorId: '',
        likeCount: stats.likeCount || '',
        commentCount: stats.commentCount || '',
        collectCount: stats.collectCount || '',
        shareCount: stats.shareCount || '',
        publishTime: publishTime
      };
    }

    function extractComments() {
      var comments = [];
      var lines = pageText.split(String.fromCharCode(10));
      var currentComment = null;
      var commentIndex = 0;
      var i = 0;
      var inCommentSection = false;
      var inContent = false;

      for (i = 0; i < lines.length; i++) {
        var line = lines[i].trim();

        if (line === '\u83b7\u53d6\u8bc4\u8bba') {
          inCommentSection = true;
          inContent = false;
          continue;
        }

        if (!inCommentSection) continue;
        if (line === '\u5927\u5bb6\u90fd\u5728\u641c\uff1a') break;
        if (line === '\u52a0\u8f7d\u4e2d') break;
        if (line.indexOf('\u524d\u5f80\u897f\u74dc\u89c6\u9891') >= 0) continue;
        if (line === '\u5206\u4eab' || line === '\u56de\u590d') continue;
        if (line === '') continue;

        if (line === '...') {
          inContent = true;
          continue;
        }

        var timeLocationMatch = line.match(/^(\d+[^\d]+\u524d|\u521a\u521a)\u00b7(.+)$/);
        if (timeLocationMatch && currentComment) {
          currentComment.time = timeLocationMatch[1];
          currentComment.location = timeLocationMatch[2];
          inContent = false;
          continue;
        }

        var likeMatch = line.match(/^(\d+)$/);
        if (likeMatch && currentComment && currentComment.time) {
          currentComment.likeCount = likeMatch[1];
          comments.push(currentComment);
          currentComment = null;
          inContent = false;
          continue;
        }

        if (!currentComment && line.length > 0 && !line.match(/^(\d+[^\d]+\u524d|\u521a\u521a)\u00b7(.+)$/) && !line.match(/^\u5c55\u5f00\d+\u6761\u56de\u590d$/)) {
          currentComment = {
            index: commentIndex++,
            author: line,
            content: '',
            likeCount: '',
            time: '',
            location: ''
          };
          inContent = false;
          continue;
        }

        if (currentComment && inContent && line.length > 0 && !currentComment.time) {
          if (currentComment.content) {
            currentComment.content += String.fromCharCode(10) + line.slice(0, 200);
          } else {
            currentComment.content = line.slice(0, 200);
          }
        }
      }

      return comments;
    }

    function getInteractiveElements() {
      var elements = [];

      elements.push({
        ref: 'comment-input',
        type: 'input',
        selector: 'textarea[placeholder*="评论"], [contenteditable="true"]',
        description: '评论输入框',
        data: { purpose: 'comment' }
      });

      var sendBtns = document.querySelectorAll('button');
      for (var si = 0; si < sendBtns.length; si++) {
        if (sendBtns[si].textContent.indexOf('发送') >= 0) {
          elements.push({
            ref: 'comment-submit',
            type: 'button',
            selector: 'button',
            description: '发送评论按钮',
            data: { purpose: 'submit-comment' }
          });
          break;
        }
      }

      var likeBtns = document.querySelectorAll('button, div');
      for (var li = 0; li < likeBtns.length; li++) {
        if (likeBtns[li].textContent.indexOf('赞') >= 0 || likeBtns[li].getAttribute('data-e2e') === 'like-btn') {
          elements.push({
            ref: 'video-like',
            type: 'button',
            selector: '[data-e2e="like-btn"], button',
            description: '点赞按钮',
            data: { purpose: 'like' }
          });
          break;
        }
      }

      var commentItems = document.querySelectorAll('[data-e2e="comment-item"], .comment-item');
      for (var ci = 0; ci < Math.min(commentItems.length, 5); ci++) {
        elements.push({
          ref: 'comment-' + ci,
          type: 'button',
          selector: '[data-e2e="comment-item"]:nth-child(' + (ci + 1) + '), .comment-item:nth-child(' + (ci + 1) + ')',
          description: '评论项 ' + (ci + 1),
          data: { purpose: 'comment-item', index: ci }
        });
      }

      return elements;
    }

    return {
      platform: 'douyin',
      pageType: 'video',
      videos: [],
      video: extractVideoDetail(),
      comments: extractComments(),
      elements: getInteractiveElements(),
      pageText: pageText.slice(0, 50000)
    };
  })()
