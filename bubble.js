/**
 * A JQuery widget for showing context-sensitive information for any form element in a popup bubble (aka tooltip).
 * 
 * Bubbles can be attached to any element and are automatically positioned to account for target element position 
 * on the page and page scroll such that they will always be visible on the page.  Bubbles will be positioned 
 * above/right, above/left, bottom/left, or bottom/right of the target using callout arrows to point to the target.
 * Each bubble contains a title and content, where content can be any HTML markup.  Hover over an element and the 
 * bubble appears immediately or after a configureable delay.  Move off the target or bubble and the bubble disappears 
 * immediately or after a configureable delay.
 * 
 * Bubble markup containing title and content can be sent with the page or created automatically in the browser.
 *
 * @name bubble
 * @function
 * @namespace bubble
 * @property {Object} props Key-Value pairs of properties.
 * @property {string} props.title The bubble title
 * @property {string} props.content The bubble content, can include HTML markup.
 * @property {string} props.ajax  URL to retrieve title and content in JSON format. This would be used
 *                                instead of the title and content attributes.
 */
(function ($) {

    // We may be dealing with 2 unique bubble instances at any time.
    // A pending bubble is one that is on a timer delay before it
    // becomes visible.  An active bubble is one that is visible.
    // These plugin variables represent these 2 Bubble class instances.
    //
    var pendingBubble = null;
    var activeBubble = null;

    var options;

    /**
     * Maximum percentage of the width of the bubble header that
     * the title can consume.  This should be a themeable parameter
     * that matches the default width specified in the stylesheet for "BubbleTitle".
     * @constant {number}
     * @default 75
     * @memberof bubble
     * @private
     */
    var BUBBLE_TITLE_WIDTH = 75;

    /**
     * The html template for the bubble widget.
     * @constant {string}
     * @memberof bubble
     * @private
     * @default
     */
    var TEMPLATE = '\
<div class="BubbleDiv" style="display:none">\n\
  <div class="BubbleShadow">\n\
    <div class="Bubble">\n\
      <div class="BubbleHeader">\n\
        <div class="BubbleTitle"></div>\n\
        <div class="BubbleCloseBtn"></div>\n\
      </div>\n\
      <div class="BubbleContent">\n\
      </div>\n\
      <div class="bottomLeftArrow"></div>\n\
      <div class="bottomRightArrow"></div>\n\
      <div class="topLeftArrow"></div>\n\
      <div class="topRightArrow"></div>\n\
    </div>\n\
  </div>\n\
</div>\n\
';

    // Plugin
    $.fn.bubble = function(opts) {

        options = $.extend({
            openDelay: 500,
            closeDelay: 2000
        }, opts);

        $(document, '.BubbleCloseBtn').click(function(event) {
            cancelBubble(event);
        });

        return this.each(function() {
            var bubbleID = $(this).data("bubbleid");
            if (bubbleID == null) {
                // No bubbleID attached to this element, then create the bubble markup for it
                // with a unique ID and set the value of the data attribute of the element to
                // the bubble's unique ID.
                bubbleID = $(TEMPLATE).appendTo('body').uniqueId().attr("id");

                if (options.ajax != null) {
                    // Get bubble title and content via ajax.  Return should be a single
                    // json object with "title" and "content" options.
                    $.getJSON(options.ajax, function(data) {
                        // Success
                        $('#' + bubbleID + ' .BubbleTitle').html(data.title);
                        $('#' + bubbleID + ' .BubbleContent').html(data.content);
                    })
                    .fail(function(jqxhr, textStatus, error) {
                        // Put the error in the bubble.
                        var err = "Request failed: " + textStatus + " " + error;
                        $('#' + bubbleID + ' .BubbleTitle').html(options.ajax);
                        $('#' + bubbleID + ' .BubbleContent').html(err);
                        console.log(err );
                    });
                } else {
                    // Get bubble title and content from options.
                    $('#' + bubbleID + ' .BubbleTitle').html(options.title);
                    $('#' + bubbleID + ' .BubbleContent').html(options.content);
                }
                //$(this).attr("data-bubbleid", bubbleID);
                $(this).data("bubbleid", bubbleID);

                // Clear options that are specific per bubble instance.
                options.title = null;
                options.content = null;
                options.ajax = null;
            }

            $(this)
                .addClass("ui-bubbleable")
                .mouseenter(function(event) {
                    var bubbleID = $(this).data("bubbleid");
                    if (bubbleID != null) {
                        initBubble(bubbleID, event);
                    }})
                .mouseout(function(event) {
                    cancelBubble(event);})
                .mousedown(function(event) {
                    cancelBubble(event);});

            return $(this);
        });

    };


    /****** Bubble class ******/

    /**
     * Backing class for the bubble plugin.
     *
     * @namespace Bubble
     * @function Bubble
     * @class
     * @constructor
     * @param id       ID of the bubble to start
     * @param evt      event associated with the creation of this bubble.
     * @private
     */
    function Bubble(id, evt) {
        this.id = id;
        this.evt = evt;
        this.target = evt.target;
        this.timeoutID = null;
        this.cancelled = false;  // only applicable to an active bubble
        this.stopped = false;    // only applicable to an active bubble
        this.arrow = null;
    
        // Get the absolute position of the target.
        var offset = $(this.target).offset();
        this.target.absLeft = offset.left;
        this.target.absTop = offset.top;
    
        // Get the DOM element for the bubble.
        var bubble = $("#" + this.id).get(0);
    
        // The 1st instance of this bubble element will not have the "payload" property
        // set.  In this case, we want to grab any positioning information that may have
        // been specified as part of the style attribute.  Specific positioning can be
        // used to override the default positioning of the bubble.
        //
        if (bubble.payload == null) {
            var t = parseInt($("#" + this.id).css("top"));
            var l = parseInt($("#" + this.id).css("left"));
            if ($.isNumeric(t)) {
                this.top = t;
            }
            if ($.isNumeric(l)) {
                this.left = l;
            }
        } else {
            // Old payload exists, so migrate positioning info from it to this object.
            this.top = bubble.payload.top;
            this.left = bubble.payload.left;
        }
    
        // Extend the DOM object to account for our Bubble object payload, so
        // we can register event handlers for the payload.
        bubble.payload = this;
    
        bubble.onmouseover = function() {
            // Treat same as mouseover on target.  If bubble scheduled to be stopped, cancel
            // the scheduled stop.
            if (this.payload.timeoutID != null)
                clearTimeout(this.payload.timeoutID);
            this.payload.cancelled = false;
            this.payload.timeoutID = null;
        }
        bubble.onmouseout = function() {
            // Create our own event and override target to be the target
            // object associated with this bubble.
            var event = new Object();
            event.type = "mouseout";
            event.target = this.payload.target;
            cancelBubble(event);
        }
    
        // Initialize the BubbleTitle width as a percentage of the bubble header.
        $("#" + bubble.id + ".BubbleDiv .BubbleTitle").width(BUBBLE_TITLE_WIDTH + "%");
    };

    /**
     * Start bubble
     *
     * @function
     * @memberof Bubble
     * @this Bubble
     * @instance
     * @private
     */
    function start() {
    
        // Get JQuery bubble object associated with this Bubble instance.
        var bubble = $("#" + this.id);
        if (bubble.length == 0) {
            return;
        }
    
        // If bubble already rendered, do nothing.
        if (bubble.css("display") == "block") {
            return;
        }
    
        // Render the bubble.  Must do this here, else target properties referenced
        // below will not be valid.
        bubble.css("display", "block");
    
    
        ////////////////////////////////////////////////////////////////////
    
        // THIS CODE BLOCK IS NECESSARY WHEN THE PAGE FONT IS VERY SMALL,
        // AND WHICH OTHERWISE CAUSES THE PERCENTAGE OF THE HEADER WIDTH
        // ALLOCATED TO THE BUBBLE TITLE TO BE TOO LARGE SUCH THAT IT
        // ENCROACHES ON THE SPACE ALLOCATED FOR THE CLOSE BUTTON ICON,
        // RESULTING IN LAYOUT MISALIGNMENT IN THE HEADER.
    
        // Assume BubbleTitle width max percentage of the bubble header.
        var maxPercent = BUBBLE_TITLE_WIDTH;
    
        // Sum of widths of all elements in the header BUT the title.  This includes
        // the width of the close button icon, and the margins around the button and
        // the title.  This should be a themeable parameter that matches the left/right
        // margins specified in the stylesheet for "BubbleTitle" and "BubbleCloseBtn".
        nonTitleWidth = 39;
    
        // Get the widths (in pixels) of the bubble header and title
        var headerWidth = $("#" + bubble.attr("id") + ".BubbleDiv .BubbleHeader").width();
        var titleWidth = $("#" + bubble.attr("id") + ".BubbleDiv .BubbleTitle").width();
    
        // Revise the aforementioned percentage downward until the title no longer
        // encroaches on the space allocated for the close button.  We decrement by
        // 5% each time because by doing so in smaller chunks when the font gets so
        // small only results in unnecessary extra loop interations.
        //
        if (headerWidth > nonTitleWidth) {
            while ((maxPercent > 5) && (titleWidth > (headerWidth - nonTitleWidth))) {
                maxPercent -= 5;
                $("#" + bubble.attr("id") + ".BubbleDiv .BubbleTitle").width(maxPercent + "%");
                titleWidth = $("#" + bubble.attr("id") + ".BubbleDiv .BubbleTitle").width();
            }
        }
    
        ////////////////////////////////////////////////////////////////////
    
    
        // If specific positioning specified, then simply use it.  This means the bubble
        // will not contain any callout arrows and no provisions are made to guarantee
        // the bubble renders in the viewable area.
        if ((this.top != null) && (this.left != null)) {
    
            bubble.css({"left": this.left, "top": this.top});
    
        } else {
    
            // No positioning specified, so we calculate the optimal position to guarantee
            // bubble is fully viewable and includes callout arrows.
    
    
            // A bubble can render one of 4 callout arrow images, each of which are 
            // child nodes of the bubble.  To get access to those nodes, we have to
            // traverse the bubble's container hierarchy.
            //
            var bottomLeftArrow = $("#" + bubble.attr("id") + ".BubbleDiv .bottomLeftArrow");
            var bottomRightArrow = $("#" + bubble.attr("id") + ".BubbleDiv .bottomRightArrow");
            var topLeftArrow = $("#" + bubble.attr("id") + ".BubbleDiv .topLeftArrow");
            var topRightArrow = $("#" + bubble.attr("id") + ".BubbleDiv .topRightArrow");
    
            var slidLeft = false;
    
            // Assume default bubble position northeast of target, which implies a 
            // bottomLeft callout arrow
            this.arrow = bottomLeftArrow;
    
    	    // Get the <html> node so can get scroll info
            var html = $("html");
    
            // Try to position bubble to right of target.
            var bubbleLeft = this.target.absLeft + this.target.offsetWidth + 5;
    
            // Check if right edge of bubble exceeds page boundary.
            var rightEdge = bubbleLeft + bubble.width();
            if (rightEdge > ($(document).width() + html.scrollLeft())) {
    
                // Shift bubble to left side of target;  implies a bottomRight arrow.
                bubbleLeft = this.target.absLeft - bubble.width();
                this.arrow = bottomRightArrow;
                slidLeft = true;
    
                // If left edge of bubble crosses left page boundary, then
                // reposition bubble back to right of target and implies to go
                // back to bottomLeft arrow.  User will need to use scrollbars
                // to position bubble into view.
                if (bubbleLeft <= 0) {
                    bubbleLeft = this.target.absLeft + this.target.offsetWidth + 5;
                    this.arrow = bottomLeftArrow;
                    slidLeft = false;
                }
            }
    
            // Try to position bubble above target
            var bubbleTop = this.target.absTop - bubble.height();
    
            // Check if top edge of bubble crosses top page boundary
            if (bubbleTop <= html.scrollTop()) {
                // Shift bubble to bottom of target.  User may need to use scrollbars
                // to position bubble into view.
                bubbleTop = this.target.absTop + this.target.offsetHeight + 5;
    
                // Use appropriate top arrow depending on left/right position.
                if (slidLeft == true)
                    this.arrow = topRightArrow;
                else
                    this.arrow = topLeftArrow;
            }
    
            // Set new bubble position.
            bubble.css({"left": bubbleLeft + "px", "top": bubbleTop + "px"});
    
            // If rendering a callout arrow, set it's position relative to the bubble.
            if (this.arrow != null) {
                $(this.arrow).css({"display": "block", "visibility": "visible"});
    
                if ((this.arrow == topLeftArrow) || (this.arrow == topRightArrow)) {
                    // Top position for top arrows is a relative vertical shift by an
                    // amount almost equal to the bubble height, but with an adjustment.
                    // For some reason, IE8 and Opera require custom positioning of the top arrows.
                    // Don't know which "support" item to check for so we check the browser.
                    var adjustment = -2;
                    if (typeof(WebBrowser) != "undefined") {
                        if ((WebBrowser.isIE() && (WebBrowser.getVersion() == 8)) 
                             || WebBrowser.isOpera()) {
                            adjustment = 3;
                        }
                    }
                    $(this.arrow).css("top",  -(bubble.height() + adjustment) + "px");
                }
            }
        }
    
        this.evt = null;
        this.cancelled = false;
        this.stopped = false;
        this.timeoutID = null;
    
    } // start


    /**
     * Stop the bubble.  If an event is provided, the stop
     * may be conditional on the event type.  If no event
     * is provided, then use the event member for this class,
     * it may have been posted there.  Otherwise if no
     * event is available, then force an unconditional stop.
     *
     * @function
     * @memberof Bubble
     * @this Bubble
     * @instance
     * @private
     * @param evt  event associated with stopping the bubble.
     */
    function stop(evt) {
    
        // Clear any timeout associated with this bubble.
        if (this.timeoutID != null) {
            clearTimeout(this.timeoutID);
            this.timeoutID = null;
        }
        this.cancelled = false;
    
        // Get bubble object.
        var bubble = $("#" + this.id);
        if (bubble.length == 0) {
            return;
        }
    
        // If bubble not already rendered, do nothing.
        if (bubble.css("display") != "block") {
            return;
        }
    
        var evt = (evt) ? evt : this.evt;
        this.evt = null;
    
        // If the event source is any element contained in the bubble
        // BUT the close icon, then simply return without dismissing the bubble.
        if (evt != null) {
            var target = evt.target;
            while (target != null) {
                // Stop loop if bubble's close button clicked.
                if ((evt.type == "click") && (target.className != null) && (target.className == "BubbleCloseBtn"))
                    break;
    
                if (target.parentNode != null) {
                    if (target.parentNode.id == this.id)
                        // Event source is bubble, so ignore the event.
                        return;
                }
                target = target.parentNode;
            }
        }
    
        // Dismiss the bubble for all events outside the bubble.
        if (this.arrow != null) {
            $(this.arrow).css({"display": "none", "visibility": "hidden"});
        }
        bubble.css("display", "none");
        this.stopped = true;
    
    } // stop

    // Interfaces for Bubble class
    // We make the functions instance methods by assigning them
    // to the prototype object of the constructor.
    //
    Bubble.prototype.start = start;
    Bubble.prototype.stop = stop;

    /****** End Bubble class ******/

    /**
     * Initialize a bubble to start after a specified period of time.
     *
     * @function
     * @memberof bubble
     * @static
     * @private
     * @param id       ID of the bubble to start
     * @param evt      event that triggered this handler
     */
    function initBubble(id, evt) {
    
        // Do not initialize a bubble that is already pending.
        if ((pendingBubble != null) && (pendingBubble.id == id)) {
            return;
        }
    
        // Do not initialize a bubble that is already active.
        // If it was cancelled, we clear the cancel and leave
        // the bubble active.
        if ((activeBubble != null) && (activeBubble.id == id)) {
            if (activeBubble.cancelled == true) {
                clearTimeout(activeBubble.timeoutID);
                activeBubble.cancelled = false;
                activeBubble.timeoutID = null;
            }
            return;
        }
    
        pendingBubble = new Bubble(id, evt);
        pendingBubble.timeoutID = setTimeout(startBubble, options.openDelay);
    
    } // initBubble
    
    
    /**
     * Cancel the bubble.  It is possible we could be in a state of
     * transitioning between an active and pending bubble.  So we
     * unconditionally stop the pending bubble.  The active bubble
     * is "softly" cancelled only upon a mouseout event, otherwise
     * it too is stopped unconditionally.
     *
     * @function
     * @memberof bubble
     * @static
     * @private
     * @param evt      event that triggered this handler
     */
    function cancelBubble(evt) {
    
        // Unconditionally stop pending bubble.
        if (pendingBubble != null) {
            pendingBubble.stop();
            pendingBubble = null;
        }
    
        // Delay stop of active bubble on mouseout event, and only if
        // if it has not already been scheduled for stoppage.  Otherwise,
        // unconditionally stop it.
        //
        if (activeBubble != null) {
            if (evt.type == "mouseout") {
                if ((evt.target.id == activeBubble.target.id) && (activeBubble.cancelled == false)) {
                    activeBubble.evt = evt;
                    activeBubble.timeoutID = setTimeout(stopBubble, options.closeDelay);
                    activeBubble.cancelled = true;
                }
            } else {
                stopBubble(evt);
            }
        }
    
    } // cancelBubble
    
    
    /**
     * If a new bubble is pending, start it.  If another bubble already
     * started, stop it.
     * @function
     * @memberof bubble
     * @static
     * @private
     */
    function startBubble() {
    
        // Stop existing bubble unconditionally, if it exists.
        if (activeBubble != null) {
            activeBubble.stop()
        }
        activeBubble = null;
    
        // If no pending bubble registered, simply return.
        if (pendingBubble == null) {
            return;
        }

        // Don't activate pending bubble for target that is dragging.
        if ($(pendingBubble.target).hasClass('ui-draggable-dragging')) {
            pendingBubble = null;
            return;
        }
    
        // Pending bubble becomes the active one.
        activeBubble = pendingBubble;
        pendingBubble = null;
        activeBubble.start();
    
    } // startBubble
    
    
    /**
     * Stop the active bubble.
     * @function
     * @memberof bubble
     * @static
     * @private
     *
     * @param evt  event associated with stopping the bubble, or null.
     */
    function stopBubble(evt) {
    
        if (activeBubble == null)
            return;
            
        activeBubble.stop(evt);
        if (activeBubble.stopped == true)
            activeBubble = null;
    
    } // stopBubble

})(jQuery);
