# homebridge-hubitat-hubconnect

This is based off of @tonesto7 homebridge-hubitat-tonesto7

[![npm version](https://badge.fury.io/js/homebridge-hubitat-hubconnect.svg)](https://badge.fury.io/js/homebridge-hubitat-hubconnect)

**```Current App version: 0.2.11```**

<br>

# Change Log:

#### Homebridge Plugin:

***v0.1.0*** - Reworked alot of the code to allow for communication with Hubitat HubConnect<br>
***v0.1.4*** - Support of HSM if enabled, Attribute filtering for devices is possible
<br>Fixed bug of not updating tiles in HomeKit after an hour expired
<br>Fixed issuse with Siri, Show version number in logging output
<br>Fixed issue with setting Thermostat temperature
<br>configure homebridge to use Celsius
<br>
***v0.1.5*** - Fixed issue when a single device is assigned to several groups <br>
***v0.2.0*** - migrated to dynamic homebridge platform that removes the need of restarting homebridge after a device selection was changed in HubConnect, configure homebridge to use Celsius, fixed fan tile on/off functionallity, ability to create switch tiles for modes and switching of modes, HSM integration, perform daily version check against NPMJS and print logging statement on newer versions available, streamline code to share improvements with homebridge-hubitat-makerapi, ability to exclude attributes,allows correct usage of DNS host names instead of IP address to connect to hubitat, fans that support setLevel use setLevel instead of setSpeed to allow finer granularity, code baselined with homebridge-hubitat-makerapi plugin to allow faster cross-sharing of improvements,Fixed issue with multi sensors not updating temperature and humidity, fixed issue that temperature can't go negative<br>
***v0.2.4*** - changed parameter list for remote commands to hubConnect, fixed water valves<br>
***v0.2.5*** - fixed on/off for fan controllers with setLevel support<br>
***v0.2.6*** - fixed issues with setting HSM and modes from Homekit and receiving an update response to it<br>
***v0.2.7*** - always listen to event socket to receive mode updates<br>
***v0.2.8*** - Hampton Bay Fan Controllers say they have speed level even though they are off, let's fix that, fixed on/off for hampton bay controller, fixed water valve
***v0.2.9*** Added some debug for fans....,Fixed garage door implementation and set obstruction when status is unknown/stopped,Added "debug" mode to see calls to MakerAPI in output. See description below on how to enable it, Added ability to write logging to file<br>
***v0.2.10*** Fixed rounding issue with thermostats in auto mode<br>
***v0.2.11*** Added thermostat fan switch support (thanks @swiss6th), added ping/pong for websockets (thanks @asj)<br>

# Explanation:

### Direct Updates
This method is nearly instant.
This option allows the hub to send updates directly to your homebridge-hubitat-hubconnect installation.
The hub must be setup as a HubConnect Server and a Remote Client has to be added. See here: (https://community.hubitat.com/t/release-hubconnect-share-devices-across-multiple-hubs-even-smartthings)
The port used for this can be configured by the "local_port" setting and defaults to 20009.
The program will attempt to determine your IP address automatically, but that can be overridden by "local_ip" which is useful if you have multiple addresses.

When properly setup, you should see something like this in your Homebridge startup immediately after the PIN:
```
[2019-4-12 12:46:45] Homebridge is running on port 51826.
[2019-4-12 12:46:45] [Hubitat Dev] homebridge-hubitat-hubconnect server listening on 20009
```

<br>

# Installation:

Installation comes in two parts:

## 1. HubConnect Installation

* Follow the instructions provided by HubConnect here: https://community.hubitat.com/t/release-hubconnect-share-devices-across-multiple-hubs-even-smartthings
* Add a new Remote Client and save the <b>Connection Key</b>
* Select the devices you want to use with Homebridge under <b>Connect local devices to Client Hub</b>
* Your <u><b>```Done```</b></u> with the Hubitat install.

## 3. Homebridge Plugin Installation:

 1. Install homebridge using: ```npm i -g homebridge``` (For Homebridge Install: [Homebridge Instructions](https://github.com/nfarina/homebridge/blob/master/README.md))
 2. Install Hubitat plugin using: ```npm i -g homebridge-hubitat-hubconnect```
 3. Update your configuration file. See sample config.json snippet below.

  <h3 style="padding: 0em .6em;">Config.json Settings Example</h3>

  <h4 style="padding: 0em .6em; margin-bottom: 5px;"><u>Example of all settings. Not all settings are required. Read the breakdown below</u></h4>

   <div style=" overflow:auto;width:auto;border-width:.1em .1em .1em .8em;padding:.2em .6em;"><pre style="margin: 0; line-height: 125%"><span style="color: #f8f8f2">{</span>
   <span style="color: #f92672">&quot;platform&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;Hubitat-HubConnect&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;name&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;Hubitat&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;hubconnect_key&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;THIS-SHOULD-BE-YOUR-CONNECTION-KEY&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;mode_switches&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">true</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;local_ip&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;10.0.0.70&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;local_port&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #ae81ff">20009</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;hsm&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #ae81ff">true</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;debug&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">false</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;temperature_unit&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">"F"</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;excluded_attributes&quot;</span><span style="color: #f8f8f2">: {</span>
   <span style="color: lightblue">    &quot;HUBITAT-DEVICE-ID-1&quot;</span><span style="color: #f8f8f2">: [</span>
   <span style="color: orange">       &quot;power&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: orange">       &quot;humidity&quot;</span>
   <span style="color: #f8f8f2">    ]</span>
   <span style="color: #f8f8f2">},</span>
   <span style="color: #f92672">&quot;logFile&quot;</span><span style="color: #f8f8f2">: {</span>
   <span style="color: #f92672">      &quot;enabled&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">true</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">      &quot;path&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">      &quot;file&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">      &quot;compress&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">true</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">      &quot;keep&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">5</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">      &quot;size&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;10m&quot;</span><span style="color: #f8f8f2"></span>
   <span style="color: #f8f8f2">}<br>}</span>
</pre></div>


 * <p><u>platform</u> & <u>name</u>  <small style="color: orange; font-weight: 600;"><i>Required</i></small><br>
    This information is used by homebridge to identify the plugin and should be the settings above.</p>

 * <p><u>app_url</u> & <u>hubconnect_key</u>  <small style="color: orange; font-weight: 600;"><i>Required</i></small><br>
    This is the HubConnect Connection Key to allow to retrieve the connection paramters to the HubConnect App.</small></p>

 * <p><u>mode_switches</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small><br>
    Creates virtual switches to contol Hubitat Modes. Possible values true|false. Default is false</small></p>

 * <p><u>local_ip</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small><br>
    Defaults to first available IP on your computer<br><small style="color: gray;">Most installations won't need this, but if for any reason it can't identify your ip address correctly, use this setting to force the IP presented to Hubitat for the hub to send to.</small></p>

 * <p><u>local_port</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small><br>
   Defaults to 20009<br><small style="color: gray;">This is the port that homebridge-hubitat-hubconnect plugin will listen on for traffic from your hub. Make sure your firewall allows incoming traffic on this port from your hub's IP address.</small></p>

 * <p><u>excluded_attributes</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small><br>
   Defaults to None<br>Specify the Hubitat device by ID and the associated attributes you want homebridge-hubitat-makerapi to ignore. This prevents a Hubitat device from creating unwanted or redundant HomeKit accessories</small></p>

 * <p><u>hsm</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small><br>
   Defaults to False<br>Creates a Alarm System icon in Homekit and allows your to arm and disarm your HSM</small></p>

 * <p><u>temperature_unit</u>  <small style="color: orange; font-weight: 600;"><i>Optional</i></small><br>
    Default to F<br>Ability to configure between Celsius and Fahrenheit. Possible values: "F" or "C"</small></p>


 * <p><u>debug</u>  <small style="color: orange; font-weight: 600;"><i>Optional</i></small><br>
    Default to false<br>Enables debugging of HTTP calls to MakerAPI to troubleshoot issues</p>
 
 * <p><u>logFile</u>  <small style="color: orange; font-weight: 600;"><i>Optional</i></small><br>
    Settings to enable logging to file. Uses winston logging facility 

   * <p><u>enabled</u>  <small style="color: orange; font-weight: 600;"><i>Optional</i></small><br>
      Enable logging to file. Default is false. Set to true to enable file logging

   * <p><u>path</u>  <small style="color: orange; font-weight: 600;"><i>Optional</i></small><br>
      Path to store log files. Defaults to path where config.json is stored - Only applicable if logFile -> enable is set to true

   * <p><u>file</u>  <small style="color: orange; font-weight: 600;"><i>Optional</i></small><br>
      Filename of log file. Default is homebridge-hubitat.log - Only applicable if logFile -> enable is set to true

   * <p><u>compress</u>  <small style="color: orange; font-weight: 600;"><i>Optional</i></small><br>
      Compress log files when they rotate. Default is true - Only applicable if logFile -> enable is set to true

   * <p><u>keep</u>  <small style="color: orange; font-weight: 600;"><i>Optional</i></small><br>
      Number of log files to keep before deleting old log files. Default is 5 - Only applicable if logFile -> enable is set to true

   * <p><u>size</u>  <small style="color: orange; font-weight: 600;"><i>Optional</i></small><br>
      Maximum size of log file. Default is 10m - Only applicable if logFile -> enable is set to true

## Attribute Filtering
The **homebridge-hubitat-hubconnect** creates Homekit devices based on the attributes of devices. 
The following attributes are currently being handled: 

| **Attribute** | **HomeKit Devices** |
| ------------ | ------------ |
| thermostatOperatingState | Thermostat |
| switch and (level or hue or saturation) | Light Bulb |
| switch | Switch |
| motion | Motion Sensor |
| presence | Occupancy Sensor |
| lock | Lock Mechanism |
| temperature (and not a thermostat) | Temperature Sensor|
| contact | Contact Sensor |
| door | Garage Door Opener |
| smoke | Smoke Sensor |
| carbonMonoxide | Carbon Monoxide Sensor |
| carbonDioxideMeasurement | Carbon Dioxide Sensor |
| water | Leak Sensor |
| humidity | Humidity Sensor |
| illuminance | Light Sensor |
| battery | Battery Service |
| position | Window Covering |
| speed | Fan Controller |
| valve | Valve |

The **homebridge-hubitat-hubconnect** plugin does not discriminate! The plugin will create multiple devices in Homekit if a device has multiple of these attributes.
Let's take a window shade as an example. A window shade might have the attributes "switch" and "position" and would create two Homekit devices, one as a switch and one as window covering. 
This might not be the desired behavior and you might want to only have one Homekit devices that sets the position of the shade. The plugin allows you to filter out the "switch" attribute and won't create a Homekit device for that attribute.
To do so, you would add the following configuration to your config.json:

<div style=" overflow:auto;width:auto;border-width:.1em .1em .1em .8em;padding:.2em .6em;"><pre style="margin: 0; line-height: 125%"><span style="color: #f8f8f2"></span>
   <span style="color: #f92672">&quot;excluded_attributes&quot;</span><span style="color: #f8f8f2">: {</span>
   <span style="color: lightblue">    &quot;HUBITAT-DEVICE-ID&quot;</span><span style="color: #f8f8f2">: [</span>
   <span style="color: orange">       &quot;switch&quot;</span><span style="color: #f8f8f2"></span>
   <span style="color: #f8f8f2">    ]</span>
   <span style="color: #f8f8f2">}</span>
</pre></div>

