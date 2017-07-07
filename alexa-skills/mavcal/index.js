/* ....................................
 * Mav Cal v0.0.1 by Pradipta Shrestha
 * 
 * You can search UTA events by keyword
 * You can search UTA events by event location
 * You can search UTA events by date
 * 
 * This is built upon Alexa Skill Sample: Calendar Reader by Amazon
 * 
 * v0.0.1 Features:
 * Search UTA Events Calendar by keywords and/or date
 * 
 * Future Updates:
 * Better Cards with "Add event to Personal Calendar feature"
 * Add UTA Academic Calendar
 * 
 * ....................................
 */

var Alexa = require('alexa-sdk');
var ical = require('ical');
var http = require('http');
var utils = require('util');

var states = {
    SEARCHMODE: '_SEARCHMODE',
    DESCRIPTION: '_DESKMODE',
    OTHERS: '_OTHERS',
};
//Variables
var alexa;
var APP_ID = undefined;

// UTA Events Calendar
var URL = "http://events.uta.edu/calendar.ics";
// UTA Academic Calendar
var URL2 = "http://www.uta.edu/uta/includes/academic-calendar/export-ical.php"

var speechStrings = {
    SKILL_NAME: "University of Texas at Arlington Events calendar",
    WELCOME_MESSAGE: "You can ask for the events today. Search for events by date. or say help. What would you like? ",
    HELP_MESSAGE: "Hmm you can ask something like:	 What Excel events are happening tomorrow? Or just What events are happening tomorrow?",
    DESCRIPTION_STATE_HELP_MESSAGE: " Here are some things you can say:	 Tell me about event one. ",
    NO_DATA_MESSAGE: "Sorry there aren't any events scheduled. You can search again or say:	 Cancel. ",
    SHUTDOWN_MESSAGE: "Ok see you again soon.",
    ONE_EVENT_MESSAGE: "There is 1 event ",
    MULTIPL_EEVENT_MESSAGE: "There are %d events ",
    SCHEDULED_EVENT_MESSAGE: "scheduled for this time frame. I've sent the details to your Alexa app ",
    FIRST_THREE_MESSAGE: "Here are the first %d. ",
    EVENT_SUMMARY: "The %s event is, %s at %s on %s ",
    ONE_EVENT_SUMMARY: "The summary for this event is, %s at %s on %s",
    CARD_CONTENT_SUMMARY: "%s at %s on %s ",
    HAVE_EVENTS_REPROMPT: "Give me an event number to hear more information.",
    ONE_EVENT_REPROMPT: " Would you like to hear more information about this event? You can say: Yes I want. or. No I don't.",
    DATE_OUT_OF_RANGE: "Date is out of range please choose another date",
    EVENT_OUT_OF_RANGE: "Event number is out of range please choose another event",
    DESCRIPTION_MESSAGE: "Here's the description ",
    KILLS_KILL_MESSAGE: "Ok, great, see you next time.",
    EVENT_NUMBER_MORE_INFO_TEXT: "If you want more information, you can say, for example: Tell me about event one.",
};
// Phrases and Prompts
var skillName = "University of Texas at Arlington Events calendar: ";
var welcomeMessages = [
    "You can ask for the events today. Search for events by date or keyword. or say help. What would you like? ",
    "Ask me for UT Arlington events by date or keyword. <say-as interpret-as='interjection'>Let's Go!</say-as>",
    "<say-as interpret-as='interjection'>Mavericks!</say-as> I know all the events happening at UT Alrington. Ask away! "
];
var welcomeMessage = "You can ask for the events today. Search for events by date. or say help. What would you like? ";
//var HelpMessage = "Here are some things you can say: Is there an event today? Is there an event on the 25th of January? What are the events next week? Are there any events tomorrow?  What would you like to know?";
var HelpMessage = "Hmm you can ask something like: What Excel events are happening tomorrow? Or just What events are happening tomorrow?";
var descriptionStateHelpMessage = " Here are some things you can say: Tell me about event one. ";
var NoDataMessage = "Sorry there aren't any events scheduled. You can search again or say: Cancel. ";
var shutdownMessage = "Ok see you again soon.";
var oneEventMessage = "There is 1 event ";
var multipleEventMessage = "There are %d events ";
var scheduledEventMessage = "scheduled for this time frame. I've sent the details to your Alexa app: ";
var firstThreeMessage = "Here are the first %d. ";
var eventSummary = "The %s event is, %s at %s on %s ";
var oneEventSummary = "The summary for this event is, %s at %s on %s";
var cardContentSummary = "%s at %s on %s ";
var haveEventsReprompt = "Give me an event number to hear more information.";
var oneEventReprompt = " Would you like to hear more information about this event? You can say: Yes I want. or. No I don't.";
var dateOutOfRange = "Date is out of range please choose another date";
var eventOutOfRange = "Event number is out of range. Try again.";
var descriptionMessage = "Here's the description ";
var killSkillMessage = "Ok, great, see you next time.";
var eventNumberMoreInfoText = "If you want more information, you can say, for example: Tell me about event one.";
var cardTitle = "UT Arlington Events";
var unhandledHelpMessage = "I did not understand. You can repeat or say cancel. "

// output for Alexa
var output = "";

// stores events that are found to be in our date range
var relevantEvents = new Array();

// Adding session handlers
var newSessionHandlers = {
    'LaunchRequest': function () {
        this.handler.state = states.SEARCHMODE;
        var speechOutput = randomPhrase(welcomeMessages);
        this.emit(':ask', skillName + " " + speechOutput, speechOutput);
    },
    "searchIntent": function () {
        this.handler.state = states.SEARCHMODE;
        this.emitWithState("searchIntent");
    },
    "FindRelatedEventIntent": function () {
        this.handler.state = states.SEARCHMODE;
        this.emitWithState("FindRelatedEventIntent");
    },
    'Unhandled': function () {
        this.emit(':ask', HelpMessage, HelpMessage);
    },
};

// Create a new handler with a SEARCH state
var startSearchHandlers = Alexa.CreateStateHandler(states.SEARCHMODE, {
    'AMAZON.YesIntent': function () {
        output = randomPhrase(welcomeMessages);
        alexa.emit(':ask', output, welcomeMessage);
    },

    'AMAZON.NoIntent': function () {
        this.emit(':tell', shutdownMessage);
    },

    'AMAZON.RepeatIntent': function () {
        this.emit(':ask', output, HelpMessage);
    },
    //This will look for events with related keywords
    'FindRelatedEventIntent': function () {
        // Declare variables 
        var eventList = new Array();
        var filledSlots = delegateSlotCollection.call(this);
        var slotValue = this.event.request.intent.slots.relatedTopics.value;
        var dateSlotValue = this.event.request.intent.slots.date.value;

        if (slotValue != undefined && dateSlotValue != undefined) {
            var parent = this;

            // Using the iCal library I pass the URL of where we want to get the data from.
            ical.fromURL(URL, {}, function (err, data) {
                // Loop through all iCal data found
                for (var k in data) {
                    if (data.hasOwnProperty(k)) {
                        var ev = data[k];
                        // Pick out the data relevant to us and create an object to hold it.
                        var eventData = {
                            summary: removeTags(ev.summary),
                            location: removeTags(ev.location),
                            description: removeTags(ev.description),
                            start: ev.start
                        };
                        // add the newly created object to an array for use later.
                        eventList.push(eventData);
                    }
                }
                // Check we have data
                if (eventList.length > 0) {
                    //console.log(eventList);

                    //console.log("looking for " + slotValue + " " + eventList[0].summary);
                    // Read slot data and parse out a usable date 
                    var eventDate = getDateFromSlot(dateSlotValue);
                    // Check we have both a start and end date
                    if (eventDate.startDate && eventDate.endDate) {
                        // initiate a new array, and this time fill it with events that fit between the two dates
                        relevantEvents = getEventsBetweenDates(eventDate.startDate, eventDate.endDate, eventList);
                        if (relevantEvents.length > 0) {
                            // initiate a new array, and this time fill it with events that include the search keywords
                            relevantEvents = getRelatedEvents(slotValue, relevantEvents);

                            //Handle the events
                            if (relevantEvents.length > 0) {
                                // change state to description
                                parent.handler.state = states.DESCRIPTION;

                                // Create output for both Alexa and the content card
                                var cardContent = "";

                                //use this if only one event found. Replaced by diff message if more found.
                                output = oneEventMessage;
                                //if more than one event, replace the above message with multipleEventMessage
                                if (relevantEvents.length > 1) {
                                    output = utils.format(multipleEventMessage, relevantEvents.length);
                                }

                                output += scheduledEventMessage;

                                if (relevantEvents.length > 1) {
                                    output += utils.format(firstThreeMessage, relevantEvents.length > 3 ? 3 : relevantEvents.length);
                                    if (relevantEvents[0] != null) {
                                        var date = new Date(relevantEvents[0].start);
                                        output += utils.format(eventSummary, "First", removeTags(relevantEvents[0].summary), relevantEvents[0].location, date.toDateString() + ".");
                                    }
                                    if (relevantEvents[1]) {
                                        var date = new Date(relevantEvents[1].start);
                                        output += utils.format(eventSummary, "Second", removeTags(relevantEvents[1].summary), relevantEvents[1].location, date.toDateString() + ".");
                                    }
                                    if (relevantEvents[2]) {
                                        var date = new Date(relevantEvents[2].start);
                                        output += utils.format(eventSummary, "Third", removeTags(relevantEvents[2].summary), relevantEvents[2].location, date.toDateString() + ".");
                                    }
                                } else {
                                    if (relevantEvents[0] != null) {
                                        var date = new Date(relevantEvents[0].start);
                                        output += utils.format(oneEventSummary, removeTags(relevantEvents[0].summary), relevantEvents[0].location, date.toDateString() + ".");
                                    }
                                }

                                //Create card contents for each of the event items
                                for (var i = 0; i < relevantEvents.length; i++) {
                                    var date = new Date(relevantEvents[i].start);
                                    cardContent += utils.format(cardContentSummary, removeTags(relevantEvents[i].summary), removeTags(relevantEvents[i].location), date.toDateString() + "\n\n");
                                }

                                //Emit and reprompt
                                if (relevantEvents.length > 1) {
                                    output += eventNumberMoreInfoText;
                                    alexa.emit(':askWithCard', output, haveEventsReprompt, cardTitle, cardContent);
                                }
                                else {
                                    output += oneEventReprompt;
                                    alexa.emit(':askWithCard', output, oneEventReprompt, cardTitle, cardContent);
                                }
                            } else {
                                output = NoDataMessage;
                                alexa.emit(':ask', output, output);
                            }
                        }
                        else {
                            output = NoDataMessage;
                            alexa.emit(':ask', output, output);
                        }
                    } else {
                        output = NoDataMessage;
                        alexa.emit(':ask', output, output);
                    }
                } else {
                    output = NoDataMessage;
                    alexa.emit(':ask', output, output);
                }
            });
        }
        else {
            this.emit(":ask", "I'm sorry. What keyword did you want me to look for?", "I'm sorry.  What keyword did you want me to look for");
        }
    },
    //Find an event in the UT Arlington calendar
    'searchIntent': function () {
        // Declare variables 
        var eventList = new Array();
        var slotValue = this.event.request.intent.slots.date.value;
        if (slotValue != undefined) {
            var parent = this;

            // Using the iCal library I pass the URL of where we want to get the data from.
            ical.fromURL(URL, {}, function (err, data) {
                // Loop through all iCal data found
                for (var k in data) {
                    if (data.hasOwnProperty(k)) {
                        var ev = data[k];
                        // Pick out the data relevant to us and create an object to hold it.
                        var eventData = {
                            summary: removeTags(ev.summary),
                            location: removeTags(ev.location),
                            description: removeTags(ev.description),
                            start: ev.start
                        };
                        // add the newly created object to an array for use later.
                        eventList.push(eventData);
                    }
                }
                // Check we have data
                if (eventList.length > 0) {
                    // Read slot data and parse out a usable date 
                    var eventDate = getDateFromSlot(slotValue);
                    // Check we have both a start and end date
                    if (eventDate.startDate && eventDate.endDate) {
                        // initiate a new array, and this time fill it with events that fit between the two dates
                        relevantEvents = getEventsBetweenDates(eventDate.startDate, eventDate.endDate, eventList);

                        if (relevantEvents.length > 0) {
                            // change state to description
                            parent.handler.state = states.DESCRIPTION;

                            // Create output for both Alexa and the content card
                            var cardContent = "";

                            //use this if only one event found. Replaced by diff message if more found.
                            output = oneEventMessage;
                            //if more than one event, replace the above message with multipleEventMessage
                            if (relevantEvents.length > 1) {
                                output = utils.format(multipleEventMessage, relevantEvents.length);
                            }

                            output += scheduledEventMessage;

                            if (relevantEvents.length > 1) {
                                output += utils.format(firstThreeMessage, relevantEvents.length > 3 ? 3 : relevantEvents.length);
                                if (relevantEvents[0] != null) {
                                    var date = new Date(relevantEvents[0].start);
                                    output += utils.format(eventSummary, "First", removeTags(relevantEvents[0].summary), relevantEvents[0].location, date.toDateString() + ".");
                                }
                                if (relevantEvents[1]) {
                                    var date = new Date(relevantEvents[1].start);
                                    output += utils.format(eventSummary, "Second", removeTags(relevantEvents[1].summary), relevantEvents[1].location, date.toDateString() + ".");
                                }
                                if (relevantEvents[2]) {
                                    var date = new Date(relevantEvents[2].start);
                                    output += utils.format(eventSummary, "Third", removeTags(relevantEvents[2].summary), relevantEvents[2].location, date.toDateString() + ".");
                                }
                            } else {
                                if (relevantEvents[0] != null) {
                                    var date = new Date(relevantEvents[0].start);
                                    output += utils.format(oneEventSummary, removeTags(relevantEvents[0].summary), relevantEvents[0].location, date.toDateString() + ".");
                                }
                            }

                            //Create card contents for each of the event items
                            for (var i = 0; i < relevantEvents.length; i++) {
                                var date = new Date(relevantEvents[i].start);
                                cardContent += utils.format(cardContentSummary, removeTags(relevantEvents[i].summary), removeTags(relevantEvents[i].location), date.toDateString() + "\n\n");
                            }

                            //Emit and reprompt
                            if (relevantEvents.length > 1) {
                                output += eventNumberMoreInfoText;
                                alexa.emit(':askWithCard', output, haveEventsReprompt, cardTitle, cardContent);
                            }
                            else {
                                output += oneEventReprompt;
                                alexa.emit(':askWithCard', output, oneEventReprompt, cardTitle, cardContent);
                            }
                        } else {
                            output = NoDataMessage;
                            alexa.emit(':ask', output, output);
                        }
                    }
                    else {
                        output = NoDataMessage;
                        alexa.emit(':ask', output, output);
                    }
                } else {
                    output = NoDataMessage;
                    alexa.emit(':ask', output, output);
                }
            });
        }
        else {
            this.emit(":ask", "I'm sorry. What day did you want me to look for events?", "I'm sorry.  What day did you want me to look for events?");
        }
    },

    'AMAZON.HelpIntent': function () {
        output = HelpMessage;
        this.emit(':ask', output, output);
    },

    'AMAZON.StopIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'AMAZON.CancelIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'SessionEndedRequest': function () {
        this.emit('AMAZON.StopIntent');
    },

    'Unhandled': function () {
        this.emit(':ask', unhandledHelpMessage, unhandledHelpMessage);
    }
});

// Create a new handler object for description state
var descriptionHandlers = Alexa.CreateStateHandler(states.DESCRIPTION, {
    'eventIntent': function () {

        var reprompt = " Any other event you want to hear more about? If not just say Cancel.";
        var repromptOneEvent = " You can search again or say: Cancel. ";
        var slotValue = this.event.request.intent.slots.number.value;
        var yesnoSlotValue = this.event.request.intent.slots.yesno.value;

        // parse slot value
        var index = parseInt(slotValue) - 1;

        //this is to handle if there is only one item
        if (yesnoSlotValue) {
            if (yesnoSlotValue === "yes") {
                output = descriptionMessage + removeTags(relevantEvents[0].description +". ");
                
                //output += repromptOneEvent;

                this.emit(':tellWithCard', output, relevantEvents[0].summary, removeTags(relevantEvents[0].description));
            }
            else {
                this.emit(':ask', "You can search again or say: Cancel.");
            }

        }

        //this is to handle many events
        else if (slotValue) {
            if (relevantEvents[index]) {

                // use the slot value as an index to retrieve description from our relevant array
                output = descriptionMessage + removeTags(relevantEvents[index].description +". ");

                output += reprompt;

                this.emit(':askWithCard', output, reprompt, relevantEvents[index].summary, removeTags(relevantEvents[index].description));
            } else {
                this.emit(':ask', eventOutOfRange);
            }
        }

    },

    'AMAZON.HelpIntent': function () {
        this.emit(':ask', descriptionStateHelpMessage, descriptionStateHelpMessage);
    },

    'AMAZON.StopIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'AMAZON.CancelIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'SessionEndedRequest': function () {
        this.emitWithState('searchIntent');
    },

    'Unhandled': function(){
        this.emitWithState('searchIntent');
    },

});

var otherHandlers = Alexa.CreateStateHandler(states.OTHERS, {
    //This will add an event to your school calendar
    'AddToSchoolCalendarIntent': function () {
        this.emit(':ask', "This has not been implemented yet");
    },

    'AMAZON.HelpIntent': function () {
        this.emit(':ask', descriptionStateHelpMessage, descriptionStateHelpMessage);
    },

    'AMAZON.StopIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'AMAZON.CancelIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'SessionEndedRequest': function () {
        this.emit('AMAZON.StopIntent');
    },

    'Unhandled': function () {
        this.emit(':ask', HelpMessage, HelpMessage);
    }
})

// register handlers
exports.handler = function (event, context, callback) {
    alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    alexa.registerHandlers(newSessionHandlers, startSearchHandlers, descriptionHandlers, otherHandlers);
    alexa.execute();
};
//======== HELPER FUNCTIONS ==============

// Remove HTML tags from string
function removeTags(str) {
    if (str) {
        return str.replace(/<(?:.|\n)*?>/gm, '');
    }
}

// Given an AMAZON.DATE slot value parse out to usable JavaScript Date object
// Utterances that map to the weekend for a specific week (such as �this weekend�) convert to a date indicating the week number and weekend: 2015-W49-WE.
// Utterances that map to a month, but not a specific day (such as �next month�, or �December�) convert to a date with just the year and month: 2015-12.
// Utterances that map to a year (such as �next year�) convert to a date containing just the year: 2016.
// Utterances that map to a decade convert to a date indicating the decade: 201X.
// Utterances that map to a season (such as �next winter�) convert to a date with the year and a season indicator: winter: WI, spring: SP, summer: SU, fall: FA)
function getDateFromSlot(rawDate) {
    // try to parse data
    var date = new Date(Date.parse(rawDate));
    var result;
    // create an empty object to use later
    var eventDate = {

    };

    // if could not parse data must be one of the other formats
    if (isNaN(date)) {
        // to find out what type of date this is, we can split it and count how many parts we have see comments above.
        var res = rawDate.split("-");
        // if we have 2 bits that include a 'W' week number
        if (res.length === 2 && res[1].indexOf('W') > -1) {
            var dates = getWeekData(res);
            eventDate["startDate"] = new Date(dates.startDate);
            eventDate["endDate"] = new Date(dates.endDate);
            // if we have 3 bits, we could either have a valid date (which would have parsed already) or a weekend
        } else if (res.length === 3) {
            var dates = getWeekendData(res);
            eventDate["startDate"] = new Date(dates.startDate);
            eventDate["endDate"] = new Date(dates.endDate);
            // anything else would be out of range for this skill
        } else {
            eventDate["error"] = dateOutOfRange;
        }
        // original slot value was parsed correctly
    } else {
        eventDate["startDate"] = new Date(date).setUTCHours(0, 0, 0, 0);
        eventDate["endDate"] = new Date(date).setUTCHours(24, 0, 0, 0);
    }
    return eventDate;
}

// Given a week number return the dates for both weekend days
function getWeekendData(res) {
    if (res.length === 3) {
        var saturdayIndex = 5;
        var sundayIndex = 6;
        var weekNumber = res[1].substring(1);

        var weekStart = w2date(res[0], weekNumber, saturdayIndex);
        var weekEnd = w2date(res[0], weekNumber, sundayIndex);

        return Dates = {
            startDate: weekStart,
            endDate: weekEnd,
        };
    }
}

// Given a week number return the dates for both the start date and the end date
function getWeekData(res) {
    if (res.length === 2) {

        var mondayIndex = 0;
        var sundayIndex = 6;

        var weekNumber = res[1].substring(1);

        var weekStart = w2date(res[0], weekNumber, mondayIndex);
        var weekEnd = w2date(res[0], weekNumber, sundayIndex);

        return Dates = {
            startDate: weekStart,
            endDate: weekEnd,
        };
    }
}

// Used to work out the dates given week numbers
var w2date = function (year, wn, dayNb) {
    var day = 86400000;

    var j10 = new Date(year, 0, 10, 12, 0, 0),
        j4 = new Date(year, 0, 4, 12, 0, 0),
        mon1 = j4.getTime() - j10.getDay() * day;
    return new Date(mon1 + ((wn - 1) * 7 + dayNb) * day);
};

// Loops though the events from the iCal data, and checks which ones are between our start data and out end date
function getEventsBetweenDates(startDate, endDate, eventList) {
    var start = new Date(startDate);
    var end = new Date(endDate);
    var data = new Array();
    for (var i = 0; i < eventList.length; i++) {
        if (start <= eventList[i].start && end >= eventList[i].start) {
            data.push(eventList[i]);
        }
    }
    //console.log("FOUND " + data.length + " events between those times");
    return data;
}

//ask to fill up all slots
//code from alexa cookbook
function delegateSlotCollection() {
    //console.log("in delegateSlotCollection");
   // console.log("current dialogState: " + this.event.request.dialogState);
    if (this.event.request.dialogState === "STARTED") {
        //console.log("in Beginning");
        var updatedIntent = this.event.request.intent;
        this.emit(":delegate", updatedIntent);
    } else if (this.event.request.dialogState !== "COMPLETED") {
        //console.log("in not completed");
        this.emit(":delegate");
    } else {
        //console.log("in completed");
        //console.log("returning: " + JSON.stringify(this.event.request.intent));
        return this.event.request.intent;
    }
}

//pass an array of prompts and return one random one for Alexa to speak
function randomPhrase(array) {
    var i = 0;
    i = Math.floor(Math.random() * array.length);
    return (array[i]);
}

function searchStringInArray(str, strArray) {
    for (var j = 0; j < strArray.length; j++) {
        if (strArray[j].match(str)) return j;
    }
    return -1;
}

function getRelatedEvents(str, eventList) {
    var data = new Array();
    str = str.toLowerCase();
    //console.log(eventList);
    var foundInSummary;
    var foundInLocation;
    var foundInDescription;

    for (var i = 0; i < eventList.length; i++) {

        if (eventList[i].summary) {
            foundInSummary = removeTags(eventList[i].summary).toLowerCase().match(str);
        }
        if (eventList[i].location) {
            foundInLocation = removeTags(eventList[i].location).toLowerCase().match(str);
        }
        if (eventList[i].description) {
            foundInDescription = removeTags(eventList[i].description).toLowerCase().match(str);
        }

        if (foundInSummary || foundInLocation || foundInDescription) {
            data.push(eventList[i]);
        }
    }
    //console.log("FOUND " + data.length + " events related to keyword/phrase: " + str);
    return data;
}
