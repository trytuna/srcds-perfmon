"use strict";

var rcon = require('srcds-rcon'),
	events = require('events'),
	newLineSplitRegex = /[\n\r]+/,
	whitespaceSplitRegex = /\s+/,
	Influx = require('influxdb-nodejs');

/**
 * Usage:
 * new Perfmon({ address: "123.123.123.123", password: "somerconpassword", port: 27015}, 30)
 *
 * connection is an object that matches srcds-rcon's arguments
 * pollInterval is in seconds
 */

class Perfmon extends events {
	constructor(connectionInfo, pollInterval) {
		super();
		this.connectionInfo = connectionInfo;
		this.pollInterval = pollInterval || 1;
		this.interval = setInterval(this.doPoll.bind(this), this.pollInterval * 1000);
	}

	doPoll() {
		var server = rcon(this.connectionInfo);
			server.connect().then(() => {
				return server.command("stats").then((stats) => {
					this.gotStats(stats);
				})
			})
			.then(() => {
				server.disconnect();
			});
	}

	gotStats(stats) {
		var lines = stats.split(newLineSplitRegex);
		var headers = removeBlankArrayElements(lines[0].split(whitespaceSplitRegex));
		var values = removeBlankArrayElements(lines[1].split(whitespaceSplitRegex));
		var results = {};
		for (var i = 0; i < headers.length; i++) {
			results[headers[i]] = parseFloat(values[i]);
		}

		console.log(results);

		// Write to influxdb
		const client = new Influx('http://176.9.70.30:8086/csgo');
		client.write('perf')
		.tag({
			server: 1
		})
		.field({
			CPU: results.CPU,
			NetIn: results.NetIn,
			NetOut: results.NetOut,
			Uptime: results.Uptime,
			FPS: results.FPS,
			Players: results.Players,
			Svms: results.Svms,
			'+-ms': results['+-ms'],
			'~tick': results['~tick']
		}).then(() => {
		}).catch(err => {
			console.error(err);
		});

		this.emit("data", results);
	}

	stop() {
		clearInterval(this.interval);
	}
}

module.exports = Perfmon;

function removeBlankArrayElements(arr) {
	return arr.filter((e) => {return e !== '' && e !== undefined});
}
