/*  This is part of the DCC++ EX Project for model railroading and more.
    For licence information, please see index.html
    For more information, see us at dcc-ex.com.
    
    commandController.js
    
    Open a serial port and create a stream to read and write data
    While there is data, we read the results in loop function
*/
$(document).ready(function(){
    console.log("Command Controller loaded");
    uiDisable(true)
//    emulatorClass = new Emulator({logger: displayLog});
});

// - Request a port and open an asynchronous connection, 
//   which prevents the UI from blocking when waiting for
//   input, and allows serial to be received by the web page
//   whenever it arrives.
async function connectServer() {
    // Gets values of the connection method selector
//    selectMethod = document.getElementById('select-method')
    mode = "serial"; //selectMethod.value;
    // Disables selector so it can't be changed whilst connected
//    selectMethod.disabled = true;
    // Checks which method was selected
    switch (mode)
    {
		case "serial":
		{
			try{
				// - Request a port and open an asynchronous connection, 
				//   which prevents the UI from blocking when waiting for
				//   input, and allows serial to be received by the web page
				//   whenever it arrives.
            
				port = await navigator.serial.requestPort(); // prompt user to select device connected to a com port
				// - Wait for the port to open.
				await port.open({ baudRate: 115200 });         // open the port at the proper supported baud rate

				// create a text encoder output stream and pipe the stream to port.writeable
				const encoder = new TextEncoderStream();
				outputDone = encoder.readable.pipeTo(port.writable);
				outputStream = encoder.writable;

				// To put the system into a known state and stop it from echoing back the characters that we send it, 
				// we need to send a CTRL-C and turn off the echo
//				writeToStream('\x03', 'echo(false);');

				// Create an input stream and a reader to read the data. port.readable gets the readable stream
				// DCC++ commands are text, so we will pipe it through a text decoder. 
				let decoder = new TextDecoderStream();
				inputDone = port.readable.pipeTo(decoder.writable);
				inputStream = decoder.readable
				//  .pipeThrough(new TransformStream(new LineBreakTransformer())); // added this line to pump through transformer
				//.pipeThrough(new TransformStream(new JSONTransformer()));

				// get a reader and start the non-blocking asynchronous read loop to read data from the stream.
				reader = inputStream.getReader();
				readLoop();
				uiDisable(false)
				displayLog("[CONNECTION] Serial connected")
				return true;
			} catch (err) {
				console.log("User didn't select a port to connect to")
				return false;
			}
		}
		break;
/*
		case "websock":
		{
			thisIP = getPreference("websockip");
			if (thisIP != null)
			{
				startWebsockets(thisIP);
				displayLog("[CONNECTION] Websocket connected")
				uiDisable(false)
				return true;
			}
			else
				return false;
		}
		break;
		default:{
			// If using the emulator
			emulatorMode = true;
			// Displays dummy hardware message
			displayLog("\n[CONNECTION] Emulator connected")
			displayLog("[RECEIVE] DCC++ EX COMMAND STATION FOR EMULATOR / EMULATOR MOTOR SHIELD: V-1.0.0 / Feb 30 2020 13:10:04")
			uiDisable(false)
			return true;
		}
*/
    }
}

function parseCommand(thisCmd) {
	console.log(thisCmd);
	switch (thisCmd[1])
	{
//		case '*': console.log("COMMENT: " + thisCmd); break;
		case 'r': 
		{
//			console.log("ADDRESS: " + thisCmd); 
			var newVal = (thisCmd.slice(2, thisCmd.length - 1)).trimStart().split(" ");
			dispAddrVal(newVal);
			break;
		}
//		default: console.log("COMMAND: " + thisCmd); break;
	}
}
// While there is still data in the serial buffer us an asynchronous read loop
// to get the data and place it in the "value" variable. When "done" is true
// all the data has been read or the port is closed
async function readLoop() {
	var cmdBuffer = "";
    while (true) {
        const { value, done } = await reader.read();
        if (value) 
        {
			for (var i = 0; i < value.length; i++)
			{
				if ((value[i] != '\n') && (value[i] !='\r'))
					cmdBuffer += value[i];
				if ((value[i] == '\n') || (value[i] =='\r'))
				{
					try
					{
						var cmdData = JSON.parse(cmdBuffer);
						if (cmdData.Cmd == "SVR")
							processConfigDataInput(cmdData);
						if (cmdData.Cmd == "DCCAmp")
							processTrackDataInput(cmdData);
					}
					catch(err)
					{
						console.log(err.message);
					}
					cmdBuffer = "";
				}
			}
//            displayLog('[RECEIVE] '+value);
        }
        if (done) {
            console.log('[readLoop] DONE'+done.toString());
            reader.releaseLock();
            break;
        }
    }
}

function writeToStream(...lines) {
  // Stops data being written to nonexistent port if using emulator
  let stream;// = emulatorClass
  if (port) {
    stream = outputStream.getWriter();
  }

  lines.forEach((line) => {
      if (line == "\x03" || line == "echo(false);") {

      } else {
          displayLog('[SEND]'+line.toString());
      }
      const packet = `${line}\n`;
      stream.write(packet)
//      console.log(packet)
  });
  stream.releaseLock();
}

// Transformer for the Web Serial API. Data comes in as a stream so we
// need a container to buffer what is coming from the serial port and
// parse the data into separate lines by looking for the breaks
class LineBreakTransformer {
        constructor() {
            // A container for holding stream data until it sees a new line.
            this.container = '';
        }

        transform(chunk, controller) {
            // Handle incoming chunk
            this.container += chunk;                      // add new data to the container 
            const lines = this.container.split('\r\n');   // look for line breaks and if it finds any
            this.container = lines.pop();                 // split them into an array
            lines.forEach(line => controller.enqueue(line)); // iterate parsed lines and send them

        }

        flush(controller) {
            // When the stream is closed, flush any remaining data
            controller.enqueue(this.container);

        }
}

// Optional transformer for use with the web serial API
// to parse a JSON file into its component commands
class JSONTransformer {
    transform(chunk, controller) {
        // Attempt to parse JSON content
        try {
        controller.enqueue(JSON.parse(chunk));
        } catch (e) {
        //displayLog(chunk.toString());
        //displayLog(chunk);
        console.log('No JSON, dumping the raw chunk', chunk);
        controller.enqueue(chunk);
        }

    }
} 

async function disconnectServer() {
    if ($("#power-switch").is(':checked')) {
	  $("#log-box").append('<br>'+'turn off power'+'<br>');
		switch (document.getElementById('select-method').value)
		{
			case "serial":
				writeToStream('0');
				break;
/*
			case "websock":
				break;
*/
		}
	  $("#power-switch").prop('checked', false)
	  $("#power-status").html('Off');
    }
    uiDisable(true)
    
//    selectMethod = document.getElementById('select-method')
//    mode = selectMethod.value;
	mode = "serial";
	switch (mode)
	{
		case "serial":
		{
			if (port) {
			// Close the input stream (reader).
				if (reader) {
					await reader.cancel();  // .cancel is asynchronous so must use await to wave for it to finish
					await inputDone.catch(() => {});
					reader = null;
					inputDone = null;
					console.log('close reader');
				}

				// Close the output stream.
				if (outputStream) {
					await outputStream.getWriter().close();
					await outputDone; // have to wait for  the azync calls to finish and outputDone to close
					outputStream = null;
					outputDone = null;
					console.log('close outputStream');
				}
				// Close the serial port.
				await port.close();
				port = null;
				console.log('close port');
				displayLog("[CONNECTION] Serial disconnected");
			} 
		}
		break;
/*
		case "emulator":
		{
			// Disables emulator
			emulatorMode = undefined;
			displayLog("[CONNECTION] Emulator disconnected");
		} 
		break;
		case "websock":
		{
			if (ws)
			{
				ws.close();
				ws = null;
			}
			displayLog("[CONNECTION] Websock disconnected");
		}
		break;
*/
	}
    // Allows a new method to be chosen
//    selectMethod.disabled = false;
}

// Connect or disconnect from the command station
async function toggleServer(btn) {
    // If already connected, disconnect
    if (port) {
        await disconnectServer();
        btn.attr('aria-state','Disconnected');
        btn.html('<span class="con-ind"></span>Connect DCC++ EX'); //<span id="con-ind"></span>Connect DCC++ EX
        return;
    }

    // Otherwise, call the connect() routine when the user clicks the connect button
    success = await connectServer();
    // Checks if the port was opened successfully
    if (success) {
        btn.attr('aria-state','Connected');
        btn.html('<span class="con-ind connected"></span>Disconnect DCC++ EX');
    } 
//    else {
//        selectMethod.disabled = false;
//    }
}

// Display log of events
function displayLog(data){
    data = data.replace("<"," ");
    data = data.replace(">"," ");
    $("#log-box").append("<br>"+data.toString()+"<br>");
    $("#log-box").scrollTop($("#log-box").prop("scrollHeight"));
}

/*
// Function to generate commands for functions F0 to F4
function sendCommandForF0ToF4(fn, opr){
    setFunCurrentVal(fn,opr);
    cabval = (128+getFunCurrentVal("f1")*1 + getFunCurrentVal("f2")*2 + getFunCurrentVal("f3")*4  + getFunCurrentVal("f4")*8 + getFunCurrentVal("f0")*16);
		switch (document.getElementById('select-method').value)
		{
			case "serial":
				writeToStream("f "+getCV()+" "+cabval);
				break;
			case "websock":
				slotInfo[4] = (slotInfo[4] & ~0x1F) | (cabval & 0x1F);
				sendDIRF();
				break;
		}
//    console.log("Command: "+ "f "+getCV()+" "+cabval);

}

// Function to generate commands for functions F5 to F8
function sendCommandForF5ToF8(fn, opr){
    setFunCurrentVal(fn,opr);
    cabval = (176+getFunCurrentVal("f5")*1 + getFunCurrentVal("f6")*2 + getFunCurrentVal("f7")*4  + getFunCurrentVal("f8")*8);
		switch (document.getElementById('select-method').value)
		{
			case "serial":
				writeToStream("f "+getCV()+" "+cabval);
				break;
			case "websock":
				slotInfo[8] = (slotInfo[8] & ~0x0F) | (cabval & 0x0F);
				sendSND();
				break;
		}
//    console.log("Command: "+ "f "+getCV()+" "+cabval);

}

// Function to generate commands for functions F9 to F12
function sendCommandForF9ToF12(fn, opr){
    setFunCurrentVal(fn,opr);
    cabval = (160+getFunCurrentVal("f9")*1 + getFunCurrentVal("f10")*2 + getFunCurrentVal("f11")*4  + getFunCurrentVal("f12")*8);
		switch (document.getElementById('select-method').value)
		{
			case "serial":
				writeToStream("f "+getCV()+" "+cabval);
				break;
			case "websock":
				break;
		}
//    console.log("Command: "+ "f "+getCV()+" "+cabval);

}

// Function to generate commands for functions F13 to F20
function sendCommandForF13ToF20(fn, opr){
    setFunCurrentVal(fn,opr);
    cabval = (getFunCurrentVal("f13")*1 + getFunCurrentVal("f14")*2 + getFunCurrentVal("f15")*4  + getFunCurrentVal("f16")*8 + getFunCurrentVal("f17")*16 + getFunCurrentVal("f18")*32 + getFunCurrentVal("f19")*64 + getFunCurrentVal("f20")*128);
		switch (document.getElementById('select-method').value)
		{
			case "serial":
				writeToStream("f "+getCV()+" 222 "+cabval);
				break;
			case "websock":
				break;
		}
//    console.log("Command: "+ "f "+getCV()+" 222 "+cabval);

}

// Function to generate commands for functions F21 to F28
function sendCommandForF21ToF28(fn, opr){
    setFunCurrentVal(fn,opr);
    cabval = (getFunCurrentVal("f21")*1 + getFunCurrentVal("f22")*2 + getFunCurrentVal("f23")*4  + getFunCurrentVal("f24")*8 + getFunCurrentVal("f25")*16 + getFunCurrentVal("f26")*32 + getFunCurrentVal("f27")*64 + getFunCurrentVal("f28")*128);
		switch (document.getElementById('select-method').value)
		{
			case "serial":
				writeToStream("f "+getCV()+" 223 "+cabval);
				break;
			case "websock":
				break;
		}
//    console.log("Command: "+ "f "+getCV()+" 223 "+cabval);

}

function startWebsockets(serverIP)
{
	console.log(serverIP);
	thisIP = "ws://" + serverIP + "/ws";  
	ws = new WebSocket(thisIP);
	  
    ws.onopen = function() 
    {
		ws.send("{\"Cmd\":\"CfgData\", \"Type\":\"pgLNViewer\", \"FileName\":\"\"}");
		console.log("websock opening");
    };
 
	ws.onclose = function (evt) 
	{
		console.log("websock close");
		ws = null;
//		setTimeout(startWebsockets, 3000);
	};

	ws.onerror = function (evt) 
	{
		console.log(evt);
//		  conStatusError();
	};

    ws.onmessage = function(evt) 
    {
  		var myArr = JSON.parse(evt.data);
  		if (myArr.Cmd == "LN")
  		{		
			displayLog("[LOCONET] " + myArr.Data + ": " + getPlainMsgText(myArr.Data));
			receiveLNMsg(myArr.Data);
		}
		if ((myArr.Data[0] & 0x08) > 0)
			lastLACKMsg = myArr.Data; //keep a copy of the message if a reply is expected. This is for decoding LACK messages if meaning depends on data bytes
		else
			lastLACKMsg = []; 
	}
};

function writeToLoconet(outMsg)
{
	var outStr = "{\"Cmd\":\"LNOut\", \"Data\":[" + outMsg.toString() + "]}";
//	console.log(outStr);
	ws.send(outStr);
	
}

function receiveLNMsg(lnData)
{
    switch(lnData[0])
    {
        case 0x82 : $("#power-status").html("Off"); $("#power-switch").prop("checked", false); break;
        case 0x83 : $("#power-status").html("On"); $("#power-switch").prop("checked", true); break;
        case 0x85 : $("#power-status").html("Idle"); $("#power-switch").prop("checked", false); break;
        case 0xE7 : //slot read
			{
				if (reqSlot || (slotInfo[0] == lnData[2]))
				{
					slotInfo = lnData.slice(2, 13);
					reqSlot = false;
					console.log(slotInfo);
				}
				else
				{
				}
			}
			break;
    }

}

function getSlotInfo()
{
	if (document.getElementById('select-method').value == "websock")
	{
		locoaddr = (parseInt($("#ex-locoid").val()));
		if (locoaddr != NaN)
		{
			outMsg = [0xBF, (locoaddr & 0x3F80) >> 7, locoaddr & 0x007F];
			reqSlot = true;
			writeToLoconet(outMsg);
		}
	}
}

function sendSpeed()
{
	if (document.getElementById('select-method').value == "websock")
		writeToLoconet([0xA0, slotInfo[0], slotInfo[3]]);
}

function sendDIRF()
{
	if (document.getElementById('select-method').value == "websock")
		writeToLoconet([0xA1, slotInfo[0], slotInfo[4]]);
}

function sendSND()
{
	if (document.getElementById('select-method').value == "websock")
		writeToLoconet([0xA2, slotInfo[0], slotInfo[8]]);
}

function acquireLoco()
{
	if (document.getElementById('select-method').value == "websock")
	{
		outMsg = [0xBA, slotInfo[0], slotInfo[0]]; //null move, put to work;
		writeToLoconet(outMsg);
		$("#ex-locoid").prop('disabled', true);
		console.log("disabled");
	}
}

function releaseLoco()
{
	if (document.getElementById('select-method').value == "websock")
	{
		outMsg = [0xB5, slotInfo[0], slotInfo[1] & 0x0F]; //Set Slot Stat to unused
		writeToLoconet(outMsg);
		$("#ex-locoid").prop('disabled', false);
		console.log("enabled");
	}
}
*/
