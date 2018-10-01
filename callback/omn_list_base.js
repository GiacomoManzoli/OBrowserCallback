// $Header$
// Copyright (C) Tiger Logic Corp 2016
// JavaScript omnis framework for rendering and managing omnis remote forms
// Object handling omnis lists

// Changes
// Date				Edit				Bug					Description
// 03-Dec-15	rmm8675			ST/EC/1384	omn_list_base.js contains list code used by both Omnis HTML controls and the JS client.

// ###################################################################
// ##### static stuff ################################################
// ###################################################################

// the JS list object
//	{
//		"lstRow":boolean, // if true, the object is a single row object
//		"lstDef":[[]],		// two dimensional array, one row of eListDefColumn for each list column
//		"lstData":[[]],		// the actual list data (single dimension for rows)
//		"lstLSEL":[],			// array of list line selections
//		"lstL":number			// list's current line number
//	}


// the columns in a list definition array
// each data column in a list has one one entry in the 
// definition part of the list
var eListDefColumn =	{
												"Name":1,				// the name of the column/variable
												"Type":2,				// the main data type
												"SubType":3,		// the sub data type
												"SubLen":4,			// the maximum length, variable length data types
												"ServerXN":5,		// the server index number for an instance variable
												"Modified":6		// the modified flag, only modified variables are send to the server
											};


// list row delete actions
var eListDeleteRow = {
												"Current":0,
												"Selected":-1,
												"Deselected":-2
											};

var INVALID_LIST_INDEX = -1;
var INVALID_LIST_OPERATION = -1;

// ###################################################################
// ##### omnis list object class constructor #########################
// ###################################################################

/**
 * @constructor
 * @param omnisList
 */
function omnis_list( omnisList )
{
	// rmm_jscs2: Set lstRow to 0 rather than false
	// validate the list //mpmMenuStyles
	if ( omnisList == null ) // null means empty list // mpmPopMenu2 begins
		this.list = { "lstRow":0, "lstDef":[], "lstData":[], "lstLSEL":[], "lstL":0 };
	else if ( typeof omnisList == 'object' && "lstDef" in omnisList ) // list is valid
		this.list = omnisList;
	else if ( typeof omnisList == 'string' && omnisList.indexOf("lstDef") >= 0 ) // list suplied as JSON text
		this.list = JSON.parse(omnisList);
	else // otherwise list is invalid, create an empty valid list
		this.list = { "lstRow":0, "lstDef":[], "lstData":[], "lstLSEL":[], "lstL":0 }; // mpmPopMenu2 ends
}



// ###################################################################
// ##### getting/setting data in list ################################
// ###################################################################


// function setData( column, rowNumber, newData, canAddCols ) // mpm_cmenu2 // mpmPopMenu2
//
//		set the data for the specified column and row
//		Parameters:
//			columnNumberOrName	- can be either a name or number
//			rowNumber						- the row number (1..n), if empty the data
//														is returned from the current row
//			newData							- the data for the row and column in the list
//			canAddCols					- if true, we can add columns (extend the row array) // mpmPopMenu2
//
omnis_list.prototype.setData = function( columnNumberOrName, rowNumber, newData, canAddCols )
{ 
	var columnNumber = this.findColumn(columnNumberOrName);
	if ( columnNumber > 0 )
	{
		var theRow = this.getRowArray(rowNumber);
		if ( theRow && ( columnNumber <= theRow.length || canAddCols ) ) // mpmPopMenu2
		{
			theRow[columnNumber-1] = newData;
			return true;
		}
	}
	return false;
};


// function getData( columnNumberOrName, rowNumber )
//
//		return data for the specified column and row
//		Parameters:
//			columnNumberOrName	- can be either a name or number
//			rowNumber						- the row number (1..n), if zero, the data
//														is returned from the current row
//
omnis_list.prototype.getData = function( columnNumberOrName, rowNumber )
{ 
	var columnNumber = this.findColumn(columnNumberOrName);
	if ( columnNumber > 0 )
	{
		var theRow = this.getRowArray(rowNumber);
		if ( theRow && columnNumber <= theRow.length )
			return theRow[columnNumber-1];
	}
	return null;
};


// function getChar( columnNumberOrName, rowNumber, zeroEmpty ) // mpm_cmenu2
//
//		return character data for the specified column and row
//		Parameters:
//			columnNumberOrName	- can be either a name or number
//			rowNumber						- the row number (1..n), if zero, the data
//														is returned from the current row
//			zeroEmpty						- if true, zero values are returned as an empty string
//
omnis_list.prototype.getChar = function( columnNumberOrName, rowNumber, zeroEmpty )
{ 
	var data = this.getData( columnNumberOrName, rowNumber );
	if ( zeroEmpty && data == 0 )
		data = "";
	else if ( data == null )
		data = "";
	else if ( data.toString )
		data = data.toString();
	return data;
};


// ###################################################################
// ##### list searching and selection states #########################
// ###################################################################


// function search( columnNumberOrName, searchValue, setCurrentRow )
//
//		search a column in the list and return the first matching row
//		Parameters:
//			columnNumberOrName	- can be either a name or number
//			searchValue					- the value to search for
//			setCurrentRow				- if true search will set the current row
//			selectMatches				- if true, all matching rows are selected
//			deselectNonMatches	- if true, all non-matching rows are deselected
//
//		Returns 1..n if a match is found or zero if no match is found
//
omnis_list.prototype.search = function( columnNumberOrName, searchValue, setCurrentRow, selectMatches, deselectNonMatches )
{
	var found = 0;
	var columnNumber = this.findColumn(columnNumberOrName);
	if ( columnNumber )
	{
		var rowCnt = this.getRowCount();
		for ( var rowNo = 1 ; rowNo <= rowCnt ; rowNo++ )
		{
			var theRow = this.getRowArray(rowNo);
			if ( theRow[columnNumber-1] == searchValue )
			{
				if ( !found )
					found = rowNo;
				if ( selectMatches )
					this.setRowSelectionState( rowNo, true );
				else
					break;
			}
			else if ( deselectNonMatches )
				this.setRowSelectionState( rowNo, false );
		}
		if ( setCurrentRow )
			this.setCurrentRow( found );
	}
	return found;
};


// function getRowSelectionState( rowNumber )
//
//		get the selection state for the specified row
//		Parameters:
//			rowNumber	- the row number 1..n for which to return the state
//									if zero, the selection state for the current row is returned
//
omnis_list.prototype.getRowSelectionState = function( rowNumber )
{
	if ( !this.list.lstRow )
	{
		var rowIndex = this.rowToIndex(rowNumber);
		var theSelArray = this.list.lstLSEL;
		if ( theSelArray && rowIndex != INVALID_LIST_INDEX && rowIndex < theSelArray.length )
			return theSelArray[rowIndex];
		else
			return false;
	}
	return null;
};


// function setRowSelectionState( rowNumber, newSelectionState )
//
//		set the selection state for the specified row
//		Parameters:
//			rowNumber					- the row number for which to set the state
//													if zero, the selection state for the current row is changed
//			newSelectionState	- the new state
//
omnis_list.prototype.setRowSelectionState = function( rowNumber, newSelectionState )
{
	if ( !this.list.lstRow )
	{
		var rowIndex = this.rowToIndex(rowNumber);
		var theSelArray = this.list.lstLSEL;
		if ( theSelArray && rowIndex != INVALID_LIST_INDEX )
		{
			theSelArray[rowIndex] = newSelectionState;
			return true;
		}
	}
	return false;
};


// function setRowSelectionStateAllRows( newSelectionState ) // mpm_cmenu2
//
//		set the selection state for all rows
//		Parameters:
//			newSelectionState	- the new state
//
omnis_list.prototype.setRowSelectionStateAllRows = function( newSelectionState )
{
	if ( !this.list.lstRow )
	{
		var cnt = this.getRowCount();
		var theSelArray = this.list.lstLSEL;
		for ( var i = 0 ; i < cnt ; i++ )
			theSelArray[i] = newSelectionState;
	}
	return false;
};


// ###################################################################
// ##### current row/ row count ######################################
// ###################################################################


// function getCurrentRow()
//
//		return the current row for the list
//
omnis_list.prototype.getCurrentRow = function()
{
	if ( this.list.lstRow )
		return 1;
	else
		return this.list.lstL;
};


// function setCurrentRow( newCurrentRow )
//
//		set the current row for the list
//		Parameters:
//			newCurrentRow	- the new current row
//
omnis_list.prototype.setCurrentRow = function( newCurrentRow )
{
	if ( this.list.lstRow )
		return false;
	else if ( newCurrentRow >= 0 && newCurrentRow <= this.list.lstData.length )
	{
		this.list.lstL = newCurrentRow;
		return true;
	}
	return false;
};


// function getRowCount()
//
//		return the number of rows in the list
//
omnis_list.prototype.getRowCount = function()
{
	if ( this.list.lstRow )
		return 1;
	else
		return this.list.lstData.length;
};


// mpmStrTbl new function
// function getColumnCount()
//
//		return the number of columns in the list
//
omnis_list.prototype.getColumnCount = function()
{
	return (this.list.lstDef == null) ? 0 : this.list.lstDef.length; // rmm_jscs2: check non-null
};



// ###################################################################
// ##### adding/deleting rows ########################################
// ###################################################################


// function addRow( beforeRowNumber, columnCount )
//
//		add an empty row to the list
//		Parameters:
//			beforeRowNumber		- if non-zero the row is inserted before
//													the specified row number
//			columnCount				- the initial number of columns for the new row
//
//		Returns the row number of the new row or INVALID_LIST_OPERATION
//		if the action failed
//
omnis_list.prototype.addRow = function( beforeRowNumber, columnCount ) // rmm7172
{
	// test if it is a row variable as we cannot add a row to a row variable
	if ( this.list.lstRow )
		return INVALID_LIST_OPERATION;
	
	// Start rmm7172
	var newRowData = [];
	if (columnCount)
		newRowData[columnCount - 1] = null;
	// End rmm7172
	// get the list data array
	var theListData = this.list.lstData;
	if ( beforeRowNumber && beforeRowNumber > 0 )
	{ // insert a row
		var rowIndex = this.rowToIndex( beforeRowNumber );
		if ( rowIndex != INVALID_LIST_INDEX )
		{
			theListData.splice(rowIndex,0,newRowData);	// rmm_jscs2: 0
			this.list.lstLSEL.splice(rowIndex, 0, 0);	// rmm_jscs2
			return this.indexToRow(rowIndex);
		}
	}
	else
	{ // add a row to the end
		var rowNumber = this.getRowCount();
		theListData[rowNumber] = newRowData;	// rmm7172
		this.list.lstLSEL[rowNumber] = 0;			// rmm_jscs2
		return this.getRowCount();
	}
};


// function deleteRows( actionOrRow )
//
//		delete the rows specified by the action
//		Parameters:
//			actionOrRow		- the action (eListDeleteRow) or row number to delete
//
//		Returns row number deleted or number of rows deleted for 
//		eListDeleteRow.Selected and eListDeleteRow.Deselected
//
omnis_list.prototype.deleteRows = function( actionOrRow )
{
	// test if it is a row variable as we cannot add a row to a row variable
	if ( this.list.lstRow )
		return INVALID_LIST_OPERATION;
	
	// get the list data array
	var theListData = this.list.lstData;
	var theListSel = this.list.lstLSEL; // rmm_jscs2
	switch ( actionOrRow )
	{
		case eListDeleteRow.Current:
			{
				var curRow = this.getCurrentRow();
				if ( curRow > 0 )
				{
					var rowIndex = this.rowToIndex(curRow)
					theListData.splice( rowIndex, 1 );
					theListSel.splice( rowIndex, 1 );
				}
				return curRow;
			}
		case eListDeleteRow.Selected:
		case eListDeleteRow.Deselected:
			{
				var cnt = 0;
				var delSelected = actionOrRow == eListDeleteRow.Selected ? 1 : 0;
				for (var i = theListSel.length - 1; i >= 0 ; --i) if (theListSel[i] == delSelected) // rmm8345
				{
					theListData.splice( i, 1 );
					theListSel.splice( i, 1 );
					cnt++;
				}
				return cnt;
			}
		default:
			{ // actionOrRow = row number to delete 
				var rowIndex = this.rowToIndex( actionOrRow );
				if ( rowIndex != INVALID_LIST_INDEX ) 
				{
					theListData.splice( rowIndex, 1 );
					theListSel.splice( rowIndex, 1 );
					return actionOrRow;
				}
				break;
			}
	}
	return 0;
};



// ###################################################################
// ##### support functions ###########################################
// ###################################################################


// function findColumn( columnNumberOrName, beginsWith )
//
//		find the specified column
//		Parameters:
//			columnNumberOrName	- can be either a name or number (1..n)
//														if it is a number we return it
//			beginsWith					- if true, first partial match is returned // mpmStrTbl
//
omnis_list.prototype.findColumn = function( columnNumberOrName, beginsWith ) // mpmStrTbl
{
	beginsWith = jOmnis.defaultParameter( beginsWith, false ); // mpmStrTbl
	var col = this.columnNameToNumber(columnNumberOrName); // mpmPopMenu2 begins
	if ( col >= 1 )
		return col;
	else // mpmPopMenu2 ends
	{ // find the name in the list definition
		var theListDef = this.list.lstDef;
		if (theListDef) for ( var i = 0 ; i < theListDef.length ; i++ )
		{
			var colDef = theListDef[i];
			var colName = colDef[eListDefColumn.Name-1];
			if ( beginsWith ) // mpmStrTbl begins
			{
				if ( colName.indexOf( columnNumberOrName ) == 0 )
					return i+1;
			}
			else if ( colName == columnNumberOrName ) // mpmStrTbl ends
				return i+1; // we always return column numbers in the range 1..n
		}
	}
	return null;
};


// mpmPopMenu2 begins
// function columnNameToNumber( columnNumberOrName )
//
//		Tests if the specified column name is actually a column number
//		Supports use of "C1" to "Cn"
//		Parameters:
//			columnNumberOrName	- can be either a name or number (1..n or C1..Cn)
//		Returns
//			the column number if the name was a number, zero otherwise
//
omnis_list.prototype.columnNameToNumber = function( columnNumberOrName )
{
	if ( columnNumberOrName == null )
		return 0;
	if ( typeof columnNumberOrName == 'number' )
		return Number(columnNumberOrName);
	
	var i; var s;
	// test for column numbers preceeded by a 'C'
	if ( columnNumberOrName.indexOf( "C" ) == 0 || columnNumberOrName.indexOf( "c" ) == 0 )
	{ 
		columnNumberOrName = columnNumberOrName.toUpperCase();
		i = parseInt(columnNumberOrName.substr(1)); // rmm_jscs2
		s = "C" + i;
	}
	else // try converting to a number
	{
		i = Number(columnNumberOrName);
		s = i.toString();
	}
	
	if ( s == columnNumberOrName )
		return i;
	else
		return 0;
};
// mpmPopMenu2 ends


// function rowToIndex( rowNumber )
//
//		returns a valid row index from the given row number
//		Parameters:
//			rowNumber	-		the intended row number (1..n), if zero returns
//										the current row
//
//		Returns the index number (0..n) after applying filters (once implemented)
//
omnis_list.prototype.rowToIndex = function( rowNumber )
{
	if ( this.list.lstRow )
		return null;
	else if ( !rowNumber )
		return this.list.lstL - 1;
	else if ( rowNumber > 0 && rowNumber <= this.getRowCount() )
		return rowNumber - 1; // apply filter here
	else
		return -1;
};


// function indexToRow( indexNumber )
//
//		returns a valid row number from the given row index
//		Parameters:
//			indexNumber	-		the intended index number (0..n)
//
//		Returns the row number (1..n) after applying filters (once implemented)
//
omnis_list.prototype.indexToRow = function( indexNumber )
{
	if ( this.list.lstRow )
		return 1;
	else
		return indexNumber + 1; // apply filter here
};


// function getRowArray( rowNumber )
//
//		return the row array for the specified list row
//		Parameters:
//			rowNumber			- number of the row (1..n)
//
omnis_list.prototype.getRowArray = function( rowNumber ) 
{ 
	if ( this.list.lstRow )
	{ // for row variables just return the list data
		return this.list.lstData;
	}
	else
	{ // return array for the specified or current row
		var rowIndex = this.rowToIndex(rowNumber);
		if ( rowIndex != INVALID_LIST_INDEX ) 
			return this.list.lstData[rowIndex];
	}
	return null;
};


// mpmPopMenu2
// function getListData( rowNumber )
//
//		return the raw list data
//
omnis_list.prototype.getListData = function() 
{
	return this.list;
};
// End of file
