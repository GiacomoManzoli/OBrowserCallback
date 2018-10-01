// $Header: svn://svn.omnis.net/branches/Studio81x/Studio/htmlcontrols/omnishtmlcontrol.js 16868 2017-03-09 12:36:52Z bmitchell $
// Copyright (C) Tiger Logic Corp 2016
// omnishtmlcontrol.js

// Changes
// Date				Edit				Bug					Description
// 09-Mar-17	rmm9284			ST/WO/2409	Added $allowjsdraganddrop property.
// 28-Oct-15	rmm8675			ST/EC/1384	Initial implementation of obrowser xcomp.


// ################################################################################################################################################
// The main control implementation
var eWebSocketMessageTypes =
{
	"getData":0,
	"setData": 1,
	"setDataWithAck": 2,
	"setOptions": 3,
	"getCurrentLine": 4,
	"getSelectionAndCurrentLine": 5,
	"error": 6,
	"event": 7,
	"setCss": 8,
	"tabOut": 9,
	"setFocus": 10,
	"startDrag": 11,
	"hilite": 12,
	"unhilite": 13,
	"getDropLine": 14,
	"scroll": 15,
	"callControlMethod": 16,
	"controlMethodDone": 17
};

var eWebSocketParameterTypes =
{
	"value":1,
	"options":2
};

var eScrollDirections =
{
	cFLDscrollLeft:"1",
	cFLDscrollRight:"2",
	cFLDscrollUp:"3",
	cFLDscrollDown:"4"
};

function omnishtmlcontrol()
{
	this.webSocket = null;
	this.callbackObject = null;
	this.defaultHiliteBorderWidth = 2;
	this.defaultHiliteBorderColor = "black";
	this.defaultHiliteBackgroundColor = "rgba(1, 1, 1, 0.2)";
}

omnishtmlcontrol.prototype = (function () {
	// Private methods
	function buildMessage(messageType, paramType, value1, value2, value3)
	{
		var responseObject = {};
		responseObject.ORFCMess = messageType;
		if (paramType)
		{
			if (5 == arguments.length)
				responseObject.ORFCParam = [[paramType, value1, value2, value3]];
			else if (4 == arguments.length)
				responseObject.ORFCParam = [[paramType, value1, value2]];
			else
				responseObject.ORFCParam = [[paramType, value1]];
		}
		else
			responseObject.ORFCParam = [];

		return responseObject;
	}

	// Return the prototype
	return {
		constructor: omnishtmlcontrol,

		// ################################################################################################################################################
		// Public methods: NOTE THAT THE METHODS BETWEEN HERE AND THE API functions COMMENT BELOW ARE FOR INTERNAL USE

		// Add a column to a list definition, based on the type of the data
		addCol:function(lstDef, name, value)
		{
			if (typeof value == "string" || value === undefined || value === null)	// Treat undefined or null value as a string
				lstDef.push([name, 21, 255, 100000000, 0, 0]);
			else if (typeof value == "boolean")
				lstDef.push([name, 22, 0, 0, 0, 0]);
			else if (typeof value == "number")
			{
				if ((parseFloat(value) == parseInt(value, 10)) && !isNaN(value))
					lstDef.push([name, 26, 0, 0, 0, 0]);		// Integer (restricted to 32 bit, since JS does not support full 64 bit integers)
				else
					lstDef.push([name, 25, 24, 0, 0, 0]);  // Number
			}
			else
				throw "Cannot convert object member to Omnis row member"
		},

		// Convert an Omnis row to a JavaScript object
		convertOmnisRowToJavaScriptObject: function (omnisRow)
		{
			var obj = {};
			var omnisLstDefn = omnisRow.lstDef;
			var omnisData = omnisRow.lstData;
			for (var i = 0; i < omnisLstDefn.length; ++i)
			{
				var name = omnisLstDefn[i][0];
				if (!name || !name.length)
					name = "C" + (i + 1);
				obj[name] = omnisData[i];
			}
			return obj;
		},

		// Convert a JavaScript object to an Omnis row
		// Note that we require that the returned row for getdata has the same columns as the row set with setdata
		convertJavaScriptObjectToOmnisRow: function (obj, fromgetdata)
		{
			var omnisRow = { "lstRow": 1, "lstDef": [], "lstData": [] };
			if (fromgetdata && jOmnis.rowDefn)
			{
				omnisRow.lstDef = jOmnis.rowDefn;
			}
			else
			{
				// In this case, we are sending an object created by the browser code that has never been defined by Omnis e.g. the event parameter object
				// passed to sendEvent.  These must have character, integer/number or boolean members only.
				omnisRow.lstDef = [];
				var members = Object.keys(obj);
				for (var i = 0; i < members.length; ++i)
				{
					var name = members[i];
					var value = obj[name];
					this.addCol(omnisRow.lstDef, name, value);
				}
			}
			for (var i = 0; i < omnisRow.lstDef.length; ++i)
			{
				omnisRow.lstData[i] = obj[omnisRow.lstDef[i][0]];
			}
			return omnisRow;
		},

		// Process get data message
		processGetDataMessage: function (ws, msgObject)
		{
			var value = jOmnis.callbackObject.omnisGetData();
			if (value)
			{
				if (value instanceof omnis_list)
					value = value.list;
				else if (value instanceof Object && !value.lstData)
					value = jOmnis.convertJavaScriptObjectToOmnisRow(value, true);
			}
			ws.send(JSON.stringify(buildMessage(eWebSocketMessageTypes.getData, eWebSocketParameterTypes.value, value)));
		},

		// Process set data message
		processSetDataMessage: function(ws, msgObject)
		{
			var value = msgObject.ORFCParam[0][1];	// Set data has a single parameter (index 0)
			if (value instanceof Object)
			{
				if (value.lstRow)
				{
					jOmnis.rowDefn = value.lstDef;
					value = jOmnis.convertOmnisRowToJavaScriptObject(value);
				}
				else if (value.lstDef)
					value = new omnis_list(value);
			}
			jOmnis.callbackObject.omnisSetData(value);
		},

		// Process set options message
		processSetOptionsMessage: function(ws, msgObject)
		{
			// Reformat the options into an object
			var omnisRow = msgObject.ORFCParam[0][1];	// Options has a single parameter
			if (omnisRow && omnisRow instanceof Object && omnisRow.lstDef && jOmnis.callbackObject.omnisSetOptions)
			{
				var options = jOmnis.convertOmnisRowToJavaScriptObject(omnisRow);
				// Pass options to callback object
				jOmnis.callbackObject.omnisSetOptions(options);
			}

			// Start rmm9284: Moved event listener to here, and only add it when JS drag and drop is not allowed (meaning we want
			// Omnis drag and drop)
			var internalOptions = msgObject.ORFCParam[0][2];
			var dragMode = (internalOptions & 0xff);
			if (!(internalOptions & 0x100))	// 0x100 flag means we want JS drag and drop
			{
				// Install drag start event listener - this allows us to take over drag and drop for Omnis HTML controls
				window.addEventListener("dragstart", function (event) {
					var draggedData;
					try {
						if (dragMode == 1 && jOmnis.callbackObject.omnisGetDraggedData)	// 1 means drag data
							draggedData = jOmnis.callbackObject.omnisGetDraggedData();
					}
					catch (e) {
						var temp = e;	// Allow a breakpoint to be set here so we can see the exception
					}
					event.preventDefault();
					event.stopPropagation();
					event.stopImmediatePropagation();
					if (draggedData != null)
						jOmnis.sendStartDragMessage(draggedData);
				}, true);
			}
			// End rmm9284
		},

		// Process get current line message
		processGetCurrentLineMessage: function(ws, msgObject)
		{
			var currentLine = jOmnis.callbackObject.omnisGetCurrentLine();
			ws.send(JSON.stringify(buildMessage(eWebSocketMessageTypes.getCurrentLine, eWebSocketParameterTypes.value, currentLine)));
		},

		// Process get selection and current line  message
		processGetSelectionAndCurrentLineMessage: function(ws, msgObject)
		{
			var currentLine = jOmnis.callbackObject.omnisGetCurrentLine();
			var selection = jOmnis.callbackObject.omnisGetSelection();
			// Process the selection - turn the array into a string (with no separators)
			// This will contain a string of bytes, where ascii zero means the line is not selected and ascii one means the line is selected
			// Note that we insert a zero at the start of the selection string - the core uses 1-based indexing for the selection array
			selection = "0" + selection.join("");
			ws.send(JSON.stringify(buildMessage(eWebSocketMessageTypes.getSelectionAndCurrentLine, eWebSocketParameterTypes.value, currentLine, selection)));
		},

		// Process set CSS message
		processSetCssMessage: function(ws, msgObject)
		{
			var h = document.getElementsByTagName("head");
			if (!h.length)
				return;
			var isNew;
			var style = jOmnis.mStyleSheet;
			if (!style)
			{
				style = document.createElement('style');
				jOmnis.mStyleSheet = style;
				style.type = 'text/css';
				h[0].appendChild(style);
			}
			style.innerHTML = msgObject.ORFCParam[0][1];

			if (jOmnis.callbackObject.omnisCssChanged)
				jOmnis.callbackObject.omnisCssChanged();
		},

		// Process set focus message
		processSetFocusMessage: function(ws, msgObject)
		{
			if (jOmnis.callbackObject.omnisSetFocus)
				jOmnis.callbackObject.omnisSetFocus();
		},

		// Process drop hilite message
		processHiliteMessage: function(ws, msgObject)
		{
			if (jOmnis.callbackObject.omnisDropHilite)
			{
				var param = msgObject.ORFCParam[0][1];
				var paramRow = param.lstData[0];
				jOmnis.callbackObject.omnisDropHilite(paramRow[0], paramRow[1]);
			}
		},
		
		// Process drop unhilite message
		processUnhiliteMessage: function(ws, msgObject)
		{
			if (jOmnis.callbackObject.omnisDropUnhilite)
			{
				jOmnis.callbackObject.omnisDropUnhilite();
			}
		},

		// Process get drop line message
		processGetDropLineMessage: function(ws, msgObject)
		{
			var dropLine = 0;
			if (jOmnis.callbackObject.omnisGetDropLine)
			{
				var param = msgObject.ORFCParam[0][1];
				var paramRow = param.lstData[0];
				dropLine = jOmnis.callbackObject.omnisGetDropLine(paramRow[0], paramRow[1]);
			}
			jOmnis.webSocket.send(JSON.stringify(buildMessage(eWebSocketMessageTypes.getDropLine, eWebSocketParameterTypes.value, dropLine)));
		},

		// Process scroll message
		processScrollMessage: function(ws, msgObject)
		{
			if (jOmnis.callbackObject.omnisDoScroll)
			{
				var param = msgObject.ORFCParam[0][1];
				var paramRow = param.lstData[0];
				var scrollDirection = paramRow[0];
				var scrollAmount = paramRow[1];

				jOmnis.callbackObject.omnisDoScroll(scrollDirection, scrollAmount);
			}
		},

		// Process call control method message
		processCallControlMethodMessage: function(ws, msgObject)
		{
			var param = msgObject.ORFCParam[0];
			var uniqueId = param[1];
			var methodName = param[2];
			var errorText;
			var retVal;
			if (!jOmnis.callbackObject[methodName])
			{
				errorText = "Method not implemented:" + methodName;
			}
			else
			{
				try
				{
					var param = param[3];
					if (param && param instanceof Object && param.lstRow)
						param = jOmnis.convertOmnisRowToJavaScriptObject(param);

					retVal = jOmnis.callbackObject[methodName](param);

					if (retVal && retVal instanceof Object && !retVal.lstDef)
						retVal = jOmnis.convertJavaScriptObjectToOmnisRow(retVal);
				}
				catch (e)
				{
					if (e && e.toLocaleString)
						errorText = e.toLocaleString();
					else
						errorText = e;
					retVal = null;
				}
			}
			jOmnis.webSocket.send(JSON.stringify(buildMessage(eWebSocketMessageTypes.controlMethodDone, eWebSocketParameterTypes.value, uniqueId, retVal, errorText)));
		},

		// Send start drag message
		sendStartDragMessage: function(dragValue)
		{
			jOmnis.webSocket.send(JSON.stringify(buildMessage(eWebSocketMessageTypes.startDrag, eWebSocketParameterTypes.value, dragValue)));
		},

		onLoad: function ()
		{
			if (!this.callbackObject)
			{
				document.body.innerHTML = "<div>Control is missing callback object</div>";
				return;	// Control has not been set up properly
			}

			// Tell the control that the document has loaded
			this.callbackObject.omnisOnLoad();

			// Split the query string
			var queryString = (function (a)
			{
				if (a == "") return {};
				var b = {};
				for (var i = 0; i < a.length; ++i)
				{
					var p = a[i].split('=', 2);
					if (p.length == 1)
						b[p[0]] = "";
					else
						b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
				}
				return b;
			})(window.location.search.substr(1).split('&'));

			// Set tooltip if present
			if (queryString["tooltip"])
				document.body.title = queryString["tooltip"];

			// Set up the web socket
			var ws = new WebSocket("ws://127.0.0.1:" + queryString["port"] + "?oo=" + queryString["oo"]);
			this.webSocket = ws;
			ws.onopen = function ()
			{
				try
				{
					if (jOmnis.callbackObject.omnisOnWebSocketOpened)
						jOmnis.callbackObject.omnisOnWebSocketOpened();
				}
				catch (e)
				{
					var temp = e;	// Allow a breakpoint to be set here so we can see the exception
				}
			};
			ws.onmessage = function (event)
			{
				var parsed = false;
				try
				{
					var msgObject = JSON.parse(event.data);
					parsed = true;
					switch (msgObject.ORFCMess)
					{
						case eWebSocketMessageTypes.getData:
							jOmnis.processGetDataMessage(ws, msgObject);
							break;
						case eWebSocketMessageTypes.setData:
						case eWebSocketMessageTypes.setDataWithAck:
							// Send ack immediately, since data will be set before the mouse event can be processed
							if (msgObject.ORFCMess == eWebSocketMessageTypes.setDataWithAck)
								ws.send(JSON.stringify(buildMessage(eWebSocketMessageTypes.setDataWithAck)));
							jOmnis.processSetDataMessage(ws, msgObject);
							break;
						case eWebSocketMessageTypes.setOptions:
							jOmnis.processSetOptionsMessage(ws, msgObject);
							break;
						case eWebSocketMessageTypes.getCurrentLine:
							jOmnis.processGetCurrentLineMessage(ws, msgObject);
							break;
						case eWebSocketMessageTypes.getSelectionAndCurrentLine:
							jOmnis.processGetSelectionAndCurrentLineMessage(ws, msgObject);
							break;
						case eWebSocketMessageTypes.setCss:
							jOmnis.processSetCssMessage(ws, msgObject);
							break;
						case eWebSocketMessageTypes.setFocus:
							jOmnis.processSetFocusMessage(ws, msgObject);
							break;
						case eWebSocketMessageTypes.hilite:
							jOmnis.processHiliteMessage(ws, msgObject);
							break;
						case eWebSocketMessageTypes.unhilite:
							jOmnis.processUnhiliteMessage(ws, msgObject);
							break;
						case eWebSocketMessageTypes.getDropLine:
							jOmnis.processGetDropLineMessage(ws, msgObject);
							break;
						case eWebSocketMessageTypes.scroll:
							jOmnis.processScrollMessage(ws, msgObject);
							break;
						case eWebSocketMessageTypes.callControlMethod:
							jOmnis.processCallControlMethodMessage(ws, msgObject);
							break;
						default:
							throw "Bad message type received";
					}					
				}
				catch (e)
				{
					// If an exception occurs, we send a message to report the error (and allow processing to continue)
					var errText;
					if (e.message)
						errText = e.message + "";
					else
						errText = e + "";
					ws.send(JSON.stringify(buildMessage(eWebSocketMessageTypes.error, eWebSocketParameterTypes.value, errText)));
				}
			};
			ws.onclose = function ()
			{
				try
				{
					if (jOmnis.callbackObject.omnisOnWebSocketClosed)
						jOmnis.callbackObject.omnisOnWebSocketClosed();
				}
				catch (e)
				{
					var temp = e;	// Allow a breakpoint to be set here so we can see the exception
				}
			}
			// Install keydown listener to detect tab out of control
			window.addEventListener("keydown", function (event)
			{
				if (event.keyCode == 9)
				{
					if (jOmnis.callbackObject.omnisTab)
					{
						// This gives the main page a chance to handle tab in and out - the callback function calls jOmnis.tabOutOfControl
						// if it wants to tab out.
						jOmnis.callbackObject.omnisTab(event);
						return;
					}
					var ti = event.target.tabIndex;
					var matches = document.querySelectorAll("[tabIndex]");
					var max = 0, min = 0x7fffffff;
					for (var i = 0; i < matches.length; ++i)
					{
						var t = matches[i].tabIndex;
						if (t > max)
							max = t;
						if (t < min)
							min = t;
					}
					if (!event.shiftKey)
					{
						if (ti == max)
							jOmnis.tabOutOfControl(false);
					}
					else
					{
						if (ti == min)
							jOmnis.tabOutOfControl(true);
					}
				}
			}, true);
		},

		// ################################################################################################################################################
		// API functions that can be called by control
		defaultParameter: function (defaultParameter, defaultValue)
		{
			return defaultParameter == null ? defaultValue : defaultParameter;
		},
		sendClickEvent:function(lineNumber)
		{
			this.webSocket.send(JSON.stringify(buildMessage(eWebSocketMessageTypes.event, eWebSocketParameterTypes.value, -5, lineNumber)));
		},
		sendDoubleClickEvent:function(lineNumber)
		{
			this.webSocket.send(JSON.stringify(buildMessage(eWebSocketMessageTypes.event, eWebSocketParameterTypes.value, -6, lineNumber)));
		},
		sendControlEvent:function(infoObject)
		{
			infoObject = jOmnis.convertJavaScriptObjectToOmnisRow(infoObject);
			this.webSocket.send(JSON.stringify(buildMessage(eWebSocketMessageTypes.event, eWebSocketParameterTypes.value, 7, infoObject)));
		},
		tabOutOfControl:function(isShiftTab)
		{
			this.webSocket.send(JSON.stringify(buildMessage(eWebSocketMessageTypes.tabOut, eWebSocketParameterTypes.value, isShiftTab)));
		},
		makeDraggedDataList:function(draggedDataArray)
		{
			// draggedDataArray is an array of arrays, where each array in the array is a list line
			// We define the list based on the first draggedDataArray entry
			var items = draggedDataArray.length;
			if (!items)
				return null;

			var list = new omnis_list();
			var firstEntry = draggedDataArray[0];
			for (var i = 0; i < firstEntry.length; ++i)
			{
				this.addCol(list.list.lstDef, "col" + (i + 1), firstEntry[i]);
			}
			for (var i = 0; i < items; ++i)
			{
				list.addRow(0, 1);
				list.list.lstData[i] = draggedDataArray[i];
			}
			return list.list;
		},
		makeDraggedDataRow:function(object)
		{
			return this.convertJavaScriptObjectToOmnisRow(object);
		},
		appendDefaultHiliteDiv:function(parentElem)
		{
			var div = document.createElement("DIV");
			div.style.backgroundColor = this.defaultHiliteBackgroundColor;
			var w = parentElem.offsetWidth;
			if (w > window.innerWidth)
				w = window.innerWidth;

			var h = parentElem.offsetHeight;
			if (h > window.innerHeight)
				h = window.innerHeight;

			div.style.width = (w - 2 * this.defaultHiliteBorderWidth) + "px";
			div.style.height = (h - 2*this.defaultHiliteBorderWidth) + "px";
			div.style.position = "absolute";
			div.style.left = "0px";
			div.style.top = "0px";
			div.style.cursor = "default";
			div.style.borderStyle = "solid";
			div.style.borderWidth = this.defaultHiliteBorderWidth + "px";
			div.style.borderColor = this.defaultHiliteBorderColor;
			parentElem.appendChild(div);
			return div;
		}
};
})();

var jOmnis = new omnishtmlcontrol();
window.addEventListener("load", function() {
	jOmnis.onLoad();
}, false);
// End of file
