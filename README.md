jqueryui-bubble
===============

A JQuery widget for showing context-sensitive information for any form element in a popup bubble (aka tooltip).

Bubbles can be attached to any element and are automatically positioned to account for target element position on the page and page scroll such that they will always be visible on the page.  Bubbles will be positioned above/right, above/left, bottom/left, or bottom/right of the target using callout arrows to point to the target.  Each bubble contains a title and content, where content can be any HTML markup.  Hover over an element and the bubble appears immediately or after a configureable delay.  Move off the target or bubble and the bubble disappears immediately or after a configureable delay.

Bubble markup containing title and content can be sent with the page or created automatically in the browser.

The sample index.html shows simple target elements that can be dragged anywhere on the page to observe the behavior of the bubble positioning.

Due to a problem with positioning the top callout arrows on IE8 and Opera, a client-side browser sniffer is included.  This can be removed from the head tag if you don't care about these browsers.

Tested with JQuery 1.11.1 and 2.0.
