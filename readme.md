# OBrowserCallback

Sample code to demonstrate how to call an Omnis method from an HTMLControl embedded in an OBrowser control.

## Contents:

- `build/OBrowserCallback.lbs`: the sample lib.
- `OBrowserCallback`: JSON source of the library
- `htmlcontrols`: the HTMLControls for the demo (it inclues also the Omnis JavaScript files).

## Demo 1 - Direct callback call (`Wnd_Main`)

The "*Set Callback*" button of the window calls a function of the `callback` HTMLControl and passes to it some data (a string) and the full-notation path to the method that has to be called when a certain event (on the HTMLControl) occures.

The event which triggers the callback is the click on the HTMLControl button. 
When this event occurs, the `jOmnis.sendControlEvent` triggers che `evControlEvent` of the OBrowser Component and provide some data and the full-notation path to the Omnis method that needs to be called.
Finally the event handler evaluates the notation and passed the event's payload has a parameter.

## Demo 2 - Event from the HTMLControls (`Wnd_OBrowserEvents`)

The HTMLControl, after the execution of an asyncronous operation, sends an `evControlEvent` to the OBrowser with a custom event name. 
The OBrowser then handles the call by executing the private method with the same name as the custom event.
