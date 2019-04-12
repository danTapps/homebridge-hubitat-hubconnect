# homebridge-hubitat-hubconnect

This is based off of @tonesto7 homebridge-hubitat-tonesto7

[![npm version](https://badge.fury.io/js/homebridge-hubitat-hubconnect.svg)](https://badge.fury.io/js/homebridge-hubitat-hubconnect)

**```Current App version: 0.0.12```**

<br>

# Change Log:

#### Homebridge Plugin:

***v0.0.12*** - Reworked alot of the code to allow for communication with Hubitat HubConnect

<br>

# Explanation:

### Direct Updates
This method is nearly instant.
This option allows the hub to send updates directly to your homebridge-hubitat-hubconnect installation.
The hub must be setup as a HubConnect Server and a Remote Client has to be added. See here: (https://community.hubitat.com/t/release-hubconnect-share-devices-across-multiple-hubs-even-smartthings)
The port used for this can be configured by the "local_port" setting and defaults to 20009.
The program will attempt to determine your IP address automatically, but that can be overridden by "local_ip" which is useful if you have multiple addresses.

When properly setup, you should see something like this in your Homebridge startup immediately after the PIN:
CHECK
```
TBD
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
   <span style="color: #f92672">&quot;local_port&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #ae81ff">20009</span><span style="color: #f8f8f2"></span>
<span style="color: #f8f8f2">}</span>
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
