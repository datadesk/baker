import { S as SvelteComponentDev, i as init, s as safe_not_equal, d as dispatch_dev, v as validate_slots, e as element, t as text, c as claim_element, a as children, b as claim_text, f as detach_dev, g as attr_dev, h as add_location, j as insert_hydration_dev, k as append_hydration_dev, l as set_data_dev, n as noop, m as space, o as create_component, p as claim_space, q as claim_component, r as mount_component, u as transition_in, w as transition_out, x as destroy_component } from './index.chunk.js';

!function(){function e(e){let t="",s="",o=e.indexOf("#");o>=0&&(t=e.slice(o),e=e.slice(0,o));const i=e.indexOf("??");return i>=0?i+1!==e.lastIndexOf("?")&&(o=e.lastIndexOf("?")):o=e.indexOf("?"),o>=0&&(s=e.slice(o),e=e.slice(0,o)),{url:e,params:s,hash:t}}function t(t){if(!t)return "";let s;return ({url:t}=e(t)),s=0===t.indexOf("file://")?t.replace(new RegExp("^file://(localhost)?"),""):t.replace(new RegExp("^([^:]+:)?//([^:/]+)(:\\d*)?/"),"/"),decodeURIComponent(s)}function s(e,t){if((e=e.replace(/^\/+/,"").toLowerCase())===(t=t.replace(/^\/+/,"").toLowerCase()))return 1e4;const s=e.split(/\/|\\/).reverse(),o=t.split(/\/|\\/).reverse(),i=Math.min(s.length,o.length);let r=0;for(;r<i&&s[r]===o[r];)++r;return r}function o(e,t){return s(e,t)>0}const i=[{selector:"background",styleNames:["backgroundImage"]},{selector:"border",styleNames:["borderImage","webkitBorderImage","MozBorderImage"]}],r={stylesheetReloadTimeout:15e3};class n{constructor(e){this.func=e,this.running=!1,this.id=null,this._handler=()=>(this.running=!1,this.id=null,this.func());}start(e){this.running&&clearTimeout(this.id),this.id=setTimeout(this._handler,e),this.running=!0;}stop(){this.running&&(clearTimeout(this.id),this.running=!1,this.id=null);}}n.start=(e,t)=>setTimeout(t,e);var l="[MINI SYNC]",a=new class{constructor(e,t,s){this.window=e,this.console=t,this.Timer=s,this.document=this.window.document,this.importCacheWaitPeriod=200,this.plugins=[];}addPlugin(e){return this.plugins.push(e)}analyze(e){}reload(e,t={}){if(this.options={...r,...t},this.options.pluginOrder&&this.options.pluginOrder.length)this.runPluginsByOrder(e,t);else {for(const s of Array.from(this.plugins))if(s.reload&&s.reload(e,t))return;if(!(t.liveCSS&&e.match(/\.css(?:\.map)?$/i)&&this.reloadStylesheet(e)))if(t.liveImg&&e.match(/\.(jpe?g|png|gif)$/i))this.reloadImages(e);else {if(!t.isChromeExtension)return this.reloadPage();this.reloadChromeExtension();}}}runPluginsByOrder(e,t){t.pluginOrder.some(s=>!!("css"===s&&t.liveCSS&&e.match(/\.css(?:\.map)?$/i)&&this.reloadStylesheet(e))||("img"===s&&t.liveImg&&e.match(/\.(jpe?g|png|gif)$/i)?(this.reloadImages(e),!0):"extension"===s&&t.isChromeExtension?(this.reloadChromeExtension(),!0):"others"===s?(this.reloadPage(),!0):"external"===s?this.plugins.some(s=>{if(s.reload&&s.reload(e,t))return !0}):this.plugins.filter(e=>e.constructor.identifier===s).some(s=>{if(s.reload&&s.reload(e,t))return !0})));}reloadPage(){return this.window.document.location.reload()}reloadChromeExtension(){return this.window.chrome.runtime.reload()}reloadImages(e){let s;const r=this.generateUniqueString();for(s of Array.from(this.document.images))o(e,t(s.src))&&(s.src=this.generateCacheBustUrl(s.src,r));if(this.document.querySelectorAll)for(const{selector:t,styleNames:o}of i)for(s of Array.from(this.document.querySelectorAll(`[style*=${t}]`)))this.reloadStyleImages(s.style,o,e,r);if(this.document.styleSheets)return Array.from(this.document.styleSheets).map(t=>this.reloadStylesheetImages(t,e,r))}reloadStylesheetImages(e,t,s){let o;try{o=(e||{}).cssRules;}catch(e){}if(o)for(const e of Array.from(o))switch(e.type){case CSSRule.IMPORT_RULE:this.reloadStylesheetImages(e.styleSheet,t,s);break;case CSSRule.STYLE_RULE:for(const{styleNames:o}of i)this.reloadStyleImages(e.style,o,t,s);break;case CSSRule.MEDIA_RULE:this.reloadStylesheetImages(e,t,s);}}reloadStyleImages(e,s,i,r){for(const n of s){const s=e[n];if("string"==typeof s){const l=s.replace(new RegExp("\\burl\\s*\\(([^)]*)\\)"),(e,s)=>o(i,t(s))?`url(${this.generateCacheBustUrl(s,r)})`:e);l!==s&&(e[n]=l);}}}reloadStylesheet(e){const o=this.options||r;let i,n;const l=(()=>{const e=[];for(n of Array.from(this.document.getElementsByTagName("link")))n.rel.match(/^stylesheet$/i)&&!n.__LiveReload_pendingRemoval&&e.push(n);return e})(),a=[];for(i of Array.from(this.document.getElementsByTagName("style")))i.sheet&&this.collectImportedStylesheets(i,i.sheet,a);for(n of Array.from(l))this.collectImportedStylesheets(n,n.sheet,a);if(this.window.StyleFix&&this.document.querySelectorAll)for(i of Array.from(this.document.querySelectorAll("style[data-href]")))l.push(i);this.console.log(`LiveReload found ${l.length} LINKed stylesheets, ${a.length} @imported stylesheets`);const h=function(e,t,o=(e=>e)){let i,r={score:0};for(const n of t)i=s(e,o(n)),i>r.score&&(r={object:n,score:i});return 0===r.score?null:r}(e,l.concat(a),e=>t(this.linkHref(e)));if(h)h.object.rule?(this.console.log("LiveReload is reloading imported stylesheet: "+h.object.href),this.reattachImportedRule(h.object)):(this.console.log("LiveReload is reloading stylesheet: "+this.linkHref(h.object)),this.reattachStylesheetLink(h.object));else if(o.reloadMissingCSS)for(n of(this.console.log(`LiveReload will reload all stylesheets because path '${e}' did not match any specific one. To disable this behavior, set 'options.reloadMissingCSS' to 'false'.`),Array.from(l)))this.reattachStylesheetLink(n);else this.console.log(`LiveReload will not reload path '${e}' because the stylesheet was not found on the page and 'options.reloadMissingCSS' was set to 'false'.`);return !0}collectImportedStylesheets(e,t,s){let o;try{o=(t||{}).cssRules;}catch(e){}if(o&&o.length)for(let t=0;t<o.length;t++){const i=o[t];switch(i.type){case CSSRule.CHARSET_RULE:continue;case CSSRule.IMPORT_RULE:s.push({link:e,rule:i,index:t,href:i.href}),this.collectImportedStylesheets(e,i.styleSheet,s);}}}waitUntilCssLoads(e,t){const s=this.options||r;let o=!1;const i=()=>{if(!o)return o=!0,t()};if(e.onload=()=>(this.console.log("LiveReload: the new stylesheet has finished loading"),this.knownToSupportCssOnLoad=!0,i()),!this.knownToSupportCssOnLoad){let t;(t=()=>e.sheet?(this.console.log("LiveReload is polling until the new CSS finishes loading..."),i()):this.Timer.start(50,t))();}return this.Timer.start(s.stylesheetReloadTimeout,i)}linkHref(e){return e.href||e.getAttribute&&e.getAttribute("data-href")}reattachStylesheetLink(e){let t;if(e.__LiveReload_pendingRemoval)return;e.__LiveReload_pendingRemoval=!0,"STYLE"===e.tagName?(t=this.document.createElement("link"),t.rel="stylesheet",t.media=e.media,t.disabled=e.disabled):t=e.cloneNode(!1),t.href=this.generateCacheBustUrl(this.linkHref(e));const s=e.parentNode;return s.lastChild===e?s.appendChild(t):s.insertBefore(t,e.nextSibling),this.waitUntilCssLoads(t,()=>{let s;return s=/AppleWebKit/.test(this.window.navigator.userAgent)?5:200,this.Timer.start(s,()=>{if(e.parentNode)return e.parentNode.removeChild(e),t.onreadystatechange=null,this.window.StyleFix?this.window.StyleFix.link(t):void 0})})}reattachImportedRule({rule:e,index:t,link:s}){const o=e.parentStyleSheet,i=this.generateCacheBustUrl(e.href),r=e.media.length?[].join.call(e.media,", "):"",n=`@import url("${i}") ${r};`;e.__LiveReload_newHref=i;const l=this.document.createElement("link");return l.rel="stylesheet",l.href=i,l.__LiveReload_pendingRemoval=!0,s.parentNode&&s.parentNode.insertBefore(l,s),this.Timer.start(this.importCacheWaitPeriod,()=>{if(l.parentNode&&l.parentNode.removeChild(l),e.__LiveReload_newHref===i)return o.insertRule(n,t),o.deleteRule(t+1),(e=o.cssRules[t]).__LiveReload_newHref=i,this.Timer.start(this.importCacheWaitPeriod,()=>{if(e.__LiveReload_newHref===i)return o.insertRule(n,t),o.deleteRule(t+1)})})}generateUniqueString(){return "livereload="+Date.now()}generateCacheBustUrl(t,s){const o=this.options||r;let i,n;if(s||(s=this.generateUniqueString()),({url:t,hash:i,params:n}=e(t)),o.overrideURL&&t.indexOf(o.serverURL)<0){const e=t;t=o.serverURL+o.overrideURL+"?url="+encodeURIComponent(t),this.console.log(`LiveReload is overriding source URL ${e} with ${t}`);}let l=n.replace(/(\?|&)livereload=(\d+)/,(e,t)=>`${t}${s}`);return l===n&&(l=0===n.length?"?"+s:`${n}&${s}`),t+l+i}}(window,{log:function(){}},n),h={liveCSS:!0,liveImg:!0};!function e(){var t=new EventSource("http://"+window.location.hostname+":"+window.location.port+"/__mini_sync__");t.addEventListener("open",function(){console.info("%s Development server has connected.",l);}),t.addEventListener("error",function(s){var o=t.readyState,i=o===EventSource.CONNECTING,r=o===EventSource.CLOSED;i||r?(console.info("%s Lost connection. Trying to reconnect...",l),r&&(t.close(),setTimeout(e,1e4))):console.error(s);}),t.addEventListener("reload",function(e){var t=JSON.parse(e.data).file||"";t?console.info('%s Reloading "%s".',l,t):console.info("%s Reloading entire page.",l),a.reload(t,h);});}();}();

function e({modulePath:e=".",importFunctionName:t="__import__"}={}){try{self[t]=new Function("u","return import(u)");}catch(o){const r=new URL(e,location),n=e=>{URL.revokeObjectURL(e.src),e.remove();};self[t]=e=>new Promise((o,a)=>{const c=new URL(e,r);if(self[t].moduleMap[c])return o(self[t].moduleMap[c]);const l=new Blob([`import * as m from '${c}';`,`${t}.moduleMap['${c}']=m;`],{type:"text/javascript"}),m=Object.assign(document.createElement("script"),{type:"module",src:URL.createObjectURL(l),onerror(){a(new Error(`Failed to import: ${e}`)),n(m);},onload(){o(self[t].moduleMap[c]),n(m);}});document.head.appendChild(m);}),self[t].moduleMap={};}}var t=Object.freeze({initialize:e});

// This needs to be done before any dynamic imports are used
t.initialize({
  modulePath: 'scripts/'
});

/* example/scripts/Inner.svelte generated by Svelte v3.59.2 */

const file$1 = "example/scripts/Inner.svelte";

function create_fragment$1(ctx) {
	let h1;
	let t0;
	let t1;
	let t2;

	const block = {
		c: function create() {
			h1 = element("h1");
			t0 = text("Hello, ");
			t1 = text(/*name*/ ctx[0]);
			t2 = text("!");
			this.h();
		},
		l: function claim(nodes) {
			h1 = claim_element(nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t0 = claim_text(h1_nodes, "Hello, ");
			t1 = claim_text(h1_nodes, /*name*/ ctx[0]);
			t2 = claim_text(h1_nodes, "!");
			h1_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(h1, "class", "svelte-19cn09w");
			add_location(h1, file$1, 3, 0, 46);
		},
		m: function mount(target, anchor) {
			insert_hydration_dev(target, h1, anchor);
			append_hydration_dev(h1, t0);
			append_hydration_dev(h1, t1);
			append_hydration_dev(h1, t2);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*name*/ 1) set_data_dev(t1, /*name*/ ctx[0]);
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(h1);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$1.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$1($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots('Inner', slots, []);
	let { name } = $$props;

	$$self.$$.on_mount.push(function () {
		if (name === undefined && !('name' in $$props || $$self.$$.bound[$$self.$$.props['name']])) {
			console.warn("<Inner> was created without expected prop 'name'");
		}
	});

	const writable_props = ['name'];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Inner> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ('name' in $$props) $$invalidate(0, name = $$props.name);
	};

	$$self.$capture_state = () => ({ name });

	$$self.$inject_state = $$props => {
		if ('name' in $$props) $$invalidate(0, name = $$props.name);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [name];
}

class Inner extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { name: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Inner",
			options,
			id: create_fragment$1.name
		});
	}

	get name() {
		throw new Error("<Inner>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set name(value) {
		throw new Error("<Inner>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* example/scripts/Other.svelte generated by Svelte v3.59.2 */
const file = "example/scripts/Other.svelte";

function create_fragment(ctx) {
	let h1;
	let t0;
	let t1;
	let t2;
	let t3;
	let inner;
	let current;

	inner = new Inner({
			props: { name: /*name*/ ctx[0] },
			$$inline: true
		});

	const block = {
		c: function create() {
			h1 = element("h1");
			t0 = text("Hello, ");
			t1 = text(/*name*/ ctx[0]);
			t2 = text("!");
			t3 = space();
			create_component(inner.$$.fragment);
			this.h();
		},
		l: function claim(nodes) {
			h1 = claim_element(nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t0 = claim_text(h1_nodes, "Hello, ");
			t1 = claim_text(h1_nodes, /*name*/ ctx[0]);
			t2 = claim_text(h1_nodes, "!");
			h1_nodes.forEach(detach_dev);
			t3 = claim_space(nodes);
			claim_component(inner.$$.fragment, nodes);
			this.h();
		},
		h: function hydrate() {
			attr_dev(h1, "class", "svelte-1ucbz36");
			add_location(h1, file, 4, 0, 82);
		},
		m: function mount(target, anchor) {
			insert_hydration_dev(target, h1, anchor);
			append_hydration_dev(h1, t0);
			append_hydration_dev(h1, t1);
			append_hydration_dev(h1, t2);
			insert_hydration_dev(target, t3, anchor);
			mount_component(inner, target, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (!current || dirty & /*name*/ 1) set_data_dev(t1, /*name*/ ctx[0]);
			const inner_changes = {};
			if (dirty & /*name*/ 1) inner_changes.name = /*name*/ ctx[0];
			inner.$set(inner_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(inner.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(inner.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(h1);
			if (detaching) detach_dev(t3);
			destroy_component(inner, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots('Other', slots, []);
	let { name } = $$props;

	$$self.$$.on_mount.push(function () {
		if (name === undefined && !('name' in $$props || $$self.$$.bound[$$self.$$.props['name']])) {
			console.warn("<Other> was created without expected prop 'name'");
		}
	});

	const writable_props = ['name'];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Other> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ('name' in $$props) $$invalidate(0, name = $$props.name);
	};

	$$self.$capture_state = () => ({ Inner, name });

	$$self.$inject_state = $$props => {
		if ('name' in $$props) $$invalidate(0, name = $$props.name);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [name];
}

class Other extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance, create_fragment, safe_not_equal, { name: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Other",
			options,
			id: create_fragment.name
		});
	}

	get name() {
		throw new Error("<Other>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set name(value) {
		throw new Error("<Other>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

const map = new Map();
const resolved = Promise.resolve();
console.log(map, resolved);
new Other({
  target: document.querySelector('#svelte'),
  props: {
    name: 'Svelte'
  }
});
//# sourceMappingURL=client.js.map
