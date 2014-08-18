

var Genetic = Genetic || (function(){
	
	'use strict';
	
	// facilitates communcation between web workers
	var Serialization = {
		"stringify": function (obj) {
			return JSON.stringify(obj, function (key, value) {
				if (value instanceof Function || typeof value == "function") return "__func__:" + value.toString();
				if (value instanceof RegExp) return "__regex__:" + value;
				return value;
			});
		}, "parse": function (str) {
			return JSON.parse(str, function (key, value) {
				if (typeof value != "string") return value;
				if (value.lastIndexOf("__func__:", 0) === 0) return eval('(' + value.slice(9) + ')');
				if (value.lastIndexOf("__regex__:", 0) === 0) return eval('(' + value.slice(10) + ')');
				return value;
			});
		}
	};
	
	var Select1 = {
		"Tournament": function(pop) {
			// pairwise tournament
			var n = pop.length;
			var a = pop[Math.floor(Math.random()*n)];
			var b = pop[Math.floor(Math.random()*n)];
			return this.compare(a.fitness, b.fitness) ? a.entity : b.entity;
		}
	};
	
	var Compare = {
		"Descending": function (a, b) { return a >= b; }
		, "Ascending": function (a, b) { return a < b; }
	};
	
	function Genetic() {
		
		// population
		this.fitness = null;
		this.seed = null;
		this.mutate = null;
		this.crossover = null;
		this.select1 = null;
		this.compare = null;
		
		this.configuration = {
			"size": 250
			, "crossover": 0.9
			, "mutation": 0.2
			, "iterations": 100
		};
		
		this.userData = {};
		
		this.entities = [];
		this.step = 0;
		
		this.start = function(msg) {
			var i;
			
			// seed the population
			for (i=0;i<this.configuration.size;++i)  {
				this.entities.push(this.seed(this));
			}
			
			var self = this;
			
			for (i=0;i<this.configuration.iterations;++i) {
				// score and sort
				var pop = this.entities
					.map(function (entity) {
						return {"fitness": self.fitness(entity), "entity": entity };
					}).sort(function (a, b) {
						return b.fitness - a.fitness;
					});
				
				postMessage(pop[0].fitness + " " + pop[0].entity);
				
				// mutate
				var nMutations = Math.ceil(this.entities.length*this.configuration.mutation);
				var newPop = [];
				var j;
				for (j=0;j<this.entities.length;++j) {
					if (j < nMutations)
						newPop.push(this.mutate(this.select1(pop)));
					else
						newPop.push(this.select1(pop));
				}
				
				this.entities = newPop;
			}
		}
	}
	
	Genetic.prototype.evolve = function(config, userData) {
		
		var k;
		for (k in config) {
			this.configuration[k] = config[k];
		}
		
		for (k in userData) {
			this.userData[k] = userData[k];
		}
		
		// bootstrap webworker script
		var blobScript = "'use strict'\n";
		blobScript += "var Serialization = {'stringify': " + Serialization.stringify.toString() + ", 'parse': " + Serialization.parse.toString() + "};\n";
		blobScript += "var ga = Serialization.parse(\"" + Serialization.stringify(this).replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0') + "\");\n";
		blobScript += "onmessage = function(e) { ga.start(e); }\n";
		
		// create instance in worker and call start()
		var blob = new Blob([blobScript]);
		var worker = new Worker(window.URL.createObjectURL(blob));
		worker.onmessage = function(e) {
		  console.log(e.data);
		};
		worker.onerror = function(e) {
			alert('ERROR: Line ' + e.lineno + ' in ' + e.filename + ': ' + e.message);
		};
		worker.postMessage();
	}
	
	return {
		"create": function() {
			return new Genetic();
		}, "Select1": Select1
		, "Compare": Compare
	};
	
})();
