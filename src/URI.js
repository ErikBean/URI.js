
export default function URI(url, base) {
  var _urlSupplied = arguments.length >= 1;
  var _baseSupplied = arguments.length >= 2;

  // Allow instantiation without the 'new' keyword
  if (!(this instanceof URI)) {
    if (_urlSupplied) {
      if (_baseSupplied) {
        return new URI(url, base);
      }

      return new URI(url);
    }

    return new URI();
  }

  if (url === undefined) {
    if (_urlSupplied) {
      throw new TypeError('undefined is not a valid argument for URI');
    }

    if (typeof location !== 'undefined') {
      url = location.href + '';
    } else {
      url = '';
    }
  }

  if (url === null) {
    if (_urlSupplied) {
      throw new TypeError('null is not a valid argument for URI');
    }
  }

  this.href(url);

  // resolve to base according to http://dvcs.w3.org/hg/url/raw-file/tip/Overview.html#constructor
  if (base !== undefined) {
    return this.absoluteTo(base);
  }

  return this;
}

function isInteger(value) {
  return /^[0-9]+$/.test(value);
}

URI.version = '1.19.1';

var p = URI.prototype;
var hasOwn = Object.prototype.hasOwnProperty;

function escapeRegEx(string) {
  // https://github.com/medialize/URI.js/commit/85ac21783c11f8ccab06106dba9735a31a86924d#commitcomment-821963
  return string.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
}

function getType(value) {
  // IE8 doesn't return [Object Undefined] but [Object Object] for undefined value
  if (value === undefined) {
    return 'Undefined';
  }

  return String(Object.prototype.toString.call(value)).slice(8, -1);
}

function isArray(obj) {
  return getType(obj) === 'Array';
}

function arrayContains(list, value) {
  var i, length;

  // value may be string, number, array, regexp
  if (isArray(value)) {
    // Note: this can be optimized to O(n) (instead of current O(m * n))
    for (i = 0, length = value.length; i < length; i++) {
      if (!arrayContains(list, value[i])) {
        return false;
      }
    }

    return true;
  }

  var _type = getType(value);
  for (i = 0, length = list.length; i < length; i++) {
    if (_type === 'RegExp') {
      if (typeof list[i] === 'string' && list[i].match(value)) {
        return true;
      }
    } else if (list[i] === value) {
      return true;
    }
  }

  return false;
}

function arraysEqual(one, two) {
  if (!isArray(one) || !isArray(two)) {
    return false;
  }

  // arrays can't be equal if they have different amount of content
  if (one.length !== two.length) {
    return false;
  }

  one.sort();
  two.sort();

  for (var i = 0, l = one.length; i < l; i++) {
    if (one[i] !== two[i]) {
      return false;
    }
  }

  return true;
}

function trimSlashes(text) {
  var trim_expression = /^\/+|\/+$/g;
  return text.replace(trim_expression, '');
}

URI._parts = function() {
  return {
    protocol: null,
    username: null,
    password: null,
    hostname: null,
    urn: null,
    port: null,
    path: null,
    query: null,
    fragment: null,
    // state
    preventInvalidHostname: URI.preventInvalidHostname,
    duplicateQueryParameters: URI.duplicateQueryParameters,
    escapeQuerySpace: URI.escapeQuerySpace
  };
};
// state: throw on invalid hostname
// see https://github.com/medialize/URI.js/pull/345
// and https://github.com/medialize/URI.js/issues/354
URI.preventInvalidHostname = false;
// state: allow duplicate query parameters (a=1&a=1)
URI.duplicateQueryParameters = false;
// state: replaces + with %20 (space in query strings)
URI.escapeQuerySpace = true;
// static properties
URI.protocol_expression = /^[a-z][a-z0-9.+-]*$/i;

// list of protocols which always require a hostname
URI.hostProtocols = [
  'http',
  'https'
];

// allowed hostname characters according to RFC 3986
// ALPHA DIGIT "-" "." "_" "~" "!" "$" "&" "'" "(" ")" "*" "+" "," ";" "=" %encoded
// I've never seen a (non-IDN) hostname other than: ALPHA DIGIT . - _
URI.invalid_hostname_characters = /[^a-zA-Z0-9\.\-:_]/;

function escapeForDumbFirefox36(value) {
  // https://github.com/medialize/URI.js/issues/91
  return escape(value);
}

// encoding / decoding according to RFC3986
function strictEncodeURIComponent(string) {
  // see https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/encodeURIComponent
  return encodeURIComponent(string)
    .replace(/[!'()*]/g, escapeForDumbFirefox36)
    .replace(/\*/g, '%2A');
}
URI.encode = strictEncodeURIComponent;
URI.decode = decodeURIComponent;

URI.encodeQuery = function(string, escapeQuerySpace) {
  var escaped = URI.encode(string + '');
  if (escapeQuerySpace === undefined) {
    escapeQuerySpace = URI.escapeQuerySpace;
  }

  return escapeQuerySpace ? escaped.replace(/%20/g, '+') : escaped;
};
URI.decodeQuery = function(string, escapeQuerySpace) {
  string += '';
  if (escapeQuerySpace === undefined) {
    escapeQuerySpace = URI.escapeQuerySpace;
  }

  try {
    return URI.decode(escapeQuerySpace ? string.replace(/\+/g, '%20') : string);
  } catch(e) {
    // we're not going to mess with weird encodings,
    // give up and return the undecoded original string
    // see https://github.com/medialize/URI.js/issues/87
    // see https://github.com/medialize/URI.js/issues/92
    return string;
  }
};


URI.parse = function(string, parts) {
  var pos;
  if (!parts) {
    parts = {
      preventInvalidHostname: URI.preventInvalidHostname
    };
  }
  // [protocol"://"[username[":"password]"@"]hostname[":"port]"/"?][path]["?"querystring]["#"fragment]

  // extract fragment
  pos = string.indexOf('#');
  if (pos > -1) {
    // escaping?
    parts.fragment = string.substring(pos + 1) || null;
    string = string.substring(0, pos);
  }

  // extract query
  pos = string.indexOf('?');
  if (pos > -1) {
    // escaping?
    parts.query = string.substring(pos + 1) || null;
    string = string.substring(0, pos);
  }

  // extract protocol
  if (string.substring(0, 2) === '//') {
    // relative-scheme
    parts.protocol = null;
    string = string.substring(2);
    // extract "user:pass@host:port"
    string = URI.parseAuthority(string, parts);
  } else {
    pos = string.indexOf(':');
    if (pos > -1) {
      parts.protocol = string.substring(0, pos) || null;
      if (parts.protocol && !parts.protocol.match(URI.protocol_expression)) {
        // : may be within the path
        parts.protocol = undefined;
      } else if (string.substring(pos + 1, pos + 3) === '//') {
        string = string.substring(pos + 3);

        // extract "user:pass@host:port"
        string = URI.parseAuthority(string, parts);
      } else {
        string = string.substring(pos + 1);
        parts.urn = true;
      }
    }
  }

  // what's left must be the path
  parts.path = string;

  // and we're done
  return parts;
};
URI.parseHost = function(string, parts) {
  if (!string) {
    string = '';
  }

  // Copy chrome, IE, opera backslash-handling behavior.
  // Back slashes before the query string get converted to forward slashes
  // See: https://github.com/joyent/node/blob/386fd24f49b0e9d1a8a076592a404168faeecc34/lib/url.js#L115-L124
  // See: https://code.google.com/p/chromium/issues/detail?id=25916
  // https://github.com/medialize/URI.js/pull/233
  string = string.replace(/\\/g, '/');

  // extract host:port
  var pos = string.indexOf('/');
  var bracketPos;
  var t;

  if (pos === -1) {
    pos = string.length;
  }

  if (string.charAt(0) === '[') {
    // IPv6 host - http://tools.ietf.org/html/draft-ietf-6man-text-addr-representation-04#section-6
    // I claim most client software breaks on IPv6 anyways. To simplify things, URI only accepts
    // IPv6+port in the format [2001:db8::1]:80 (for the time being)
    bracketPos = string.indexOf(']');
    parts.hostname = string.substring(1, bracketPos) || null;
    parts.port = string.substring(bracketPos + 2, pos) || null;
    if (parts.port === '/') {
      parts.port = null;
    }
  } else {
    var firstColon = string.indexOf(':');
    var firstSlash = string.indexOf('/');
    var nextColon = string.indexOf(':', firstColon + 1);
    if (nextColon !== -1 && (firstSlash === -1 || nextColon < firstSlash)) {
      // IPv6 host contains multiple colons - but no port
      // this notation is actually not allowed by RFC 3986, but we're a liberal parser
      parts.hostname = string.substring(0, pos) || null;
      parts.port = null;
    } else {
      t = string.substring(0, pos).split(':');
      parts.hostname = t[0] || null;
      parts.port = t[1] || null;
    }
  }

  if (parts.hostname && string.substring(pos).charAt(0) !== '/') {
    pos++;
    string = '/' + string;
  }


  if (parts.port) {
    URI.ensureValidPort(parts.port);
  }

  return string.substring(pos) || '/';
};
URI.parseAuthority = function(string, parts) {
  string = URI.parseUserinfo(string, parts);
  return URI.parseHost(string, parts);
};
URI.parseUserinfo = function(string, parts) {
  // extract username:password
  var firstSlash = string.indexOf('/');
  var pos = string.lastIndexOf('@', firstSlash > -1 ? firstSlash : string.length - 1);
  var t;

  // authority@ must come before /path
  if (pos > -1 && (firstSlash === -1 || pos < firstSlash)) {
    t = string.substring(0, pos).split(':');
    parts.username = t[0] ? URI.decode(t[0]) : null;
    t.shift();
    parts.password = t[0] ? URI.decode(t.join(':')) : null;
    string = string.substring(pos + 1);
  } else {
    parts.username = null;
    parts.password = null;
  }

  return string;
};
URI.parseQuery = function(string, escapeQuerySpace) {
  if (!string) {
    return {};
  }

  // throw out the funky business - "?"[name"="value"&"]+
  string = string.replace(/&+/g, '&').replace(/^\?*&*|&+$/g, '');

  if (!string) {
    return {};
  }

  var items = {};
  var splits = string.split('&');
  var length = splits.length;
  var v, name, value;

  for (var i = 0; i < length; i++) {
    v = splits[i].split('=');
    name = URI.decodeQuery(v.shift(), escapeQuerySpace);
    // no "=" is null according to http://dvcs.w3.org/hg/url/raw-file/tip/Overview.html#collect-url-parameters
    value = v.length ? URI.decodeQuery(v.join('='), escapeQuerySpace) : null;

    if (hasOwn.call(items, name)) {
      if (typeof items[name] === 'string' || items[name] === null) {
        items[name] = [items[name]];
      }

      items[name].push(value);
    } else {
      items[name] = value;
    }
  }

  return items;
};

URI.build = function(parts) {
  var t = '';

  if (parts.protocol) {
    t += parts.protocol + ':';
  }

  if (!parts.urn && (t || parts.hostname)) {
    t += '//';
  }

  t += (URI.buildAuthority(parts) || '');

  if (typeof parts.path === 'string') {
    if (parts.path.charAt(0) !== '/' && typeof parts.hostname === 'string') {
      t += '/';
    }

    t += parts.path;
  }

  if (typeof parts.query === 'string' && parts.query) {
    t += '?' + parts.query;
  }

  if (typeof parts.fragment === 'string' && parts.fragment) {
    t += '#' + parts.fragment;
  }
  return t;
};
URI.buildHost = function(parts) {
  var t = '';

  if (!parts.hostname) {
    return '';
  } else if (URI.ip6_expression.test(parts.hostname)) {
    t += '[' + parts.hostname + ']';
  } else {
    t += parts.hostname;
  }

  if (parts.port) {
    t += ':' + parts.port;
  }

  return t;
};
URI.buildAuthority = function(parts) {
  return URI.buildUserinfo(parts) + URI.buildHost(parts);
};
URI.buildUserinfo = function(parts) {
  var t = '';

  if (parts.username) {
    t += URI.encode(parts.username);
  }

  if (parts.password) {
    t += ':' + URI.encode(parts.password);
  }

  if (t) {
    t += '@';
  }

  return t;
};
URI.buildQuery = function(data, duplicateQueryParameters, escapeQuerySpace) {
  // according to http://tools.ietf.org/html/rfc3986 or http://labs.apache.org/webarch/uri/rfc/rfc3986.html
  // being »-._~!$&'()*+,;=:@/?« %HEX and alnum are allowed
  // the RFC explicitly states ?/foo being a valid use case, no mention of parameter syntax!
  // URI.js treats the query string as being application/x-www-form-urlencoded
  // see http://www.w3.org/TR/REC-html40/interact/forms.html#form-content-type

  var t = '';
  var unique, key, i, length;
  for (key in data) {
    if (hasOwn.call(data, key) && key) {
      if (isArray(data[key])) {
        unique = {};
        for (i = 0, length = data[key].length; i < length; i++) {
          if (data[key][i] !== undefined && unique[data[key][i] + ''] === undefined) {
            t += '&' + URI.buildQueryParameter(key, data[key][i], escapeQuerySpace);
            if (duplicateQueryParameters !== true) {
              unique[data[key][i] + ''] = true;
            }
          }
        }
      } else if (data[key] !== undefined) {
        t += '&' + URI.buildQueryParameter(key, data[key], escapeQuerySpace);
      }
    }
  }

  return t.substring(1);
};
URI.buildQueryParameter = function(name, value, escapeQuerySpace) {
  // http://www.w3.org/TR/REC-html40/interact/forms.html#form-content-type -- application/x-www-form-urlencoded
  // don't append "=" for null values, according to http://dvcs.w3.org/hg/url/raw-file/tip/Overview.html#url-parameter-serialization
  return URI.encodeQuery(name, escapeQuerySpace) + (value !== null ? '=' + URI.encodeQuery(value, escapeQuerySpace) : '');
};


URI.ensureValidPort = function (v) {
  if (!v) {
    return;
  }

  var port = Number(v);
  if (isInteger(port) && (port > 0) && (port < 65536)) {
    return;
  }

  throw new TypeError('Port "' + v + '" is not a valid port');
};


p.valueOf = p.toString = function() {
  return this.build(false)._string;
};

function generatePrefixAccessor(_part, _key){
  return function(v, build) {
    if (v === undefined) {
      return this._parts[_part] || '';
    } else {
      if (v !== null) {
        v = v + '';
        if (v.charAt(0) === _key) {
          v = v.substring(1);
        }
      }

      this._parts[_part] = v;
      this.build(!build);
      return this;
    }
  };
}

p.query = generatePrefixAccessor('query', '?');


p.search = function(v, build) {
  var t = this.query(v, build);
  return typeof t === 'string' && t.length ? ('?' + t) : t;
};

// component specific input validation
var _port = p.port;

p.port = function(v, build) {
  if (this._parts.urn) {
    return v === undefined ? '' : this;
  }

  if (v !== undefined) {
    if (v === 0) {
      v = null;
    }

    if (v) {
      v += '';
      if (v.charAt(0) === ':') {
        v = v.substring(1);
      }

      URI.ensureValidPort(v);
    }
  }
  return _port.call(this, v, build);
};

p.segment = function(segment, v, build) {
  var separator = this._parts.urn ? ':' : '/';
  var path = this.path();
  var absolute = path.substring(0, 1) === '/';
  var segments = path.split(separator);

  if (segment !== undefined && typeof segment !== 'number') {
    build = v;
    v = segment;
    segment = undefined;
  }

  if (segment !== undefined && typeof segment !== 'number') {
    throw new Error('Bad segment "' + segment + '", must be 0-based integer');
  }

  if (absolute) {
    segments.shift();
  }

  if (segment < 0) {
    // allow negative indexes to address from the end
    segment = Math.max(segments.length + segment, 0);
  }

  if (v === undefined) {
    /*jshint laxbreak: true */
    return segment === undefined
      ? segments
      : segments[segment];
    /*jshint laxbreak: false */
  } else if (segment === null || segments[segment] === undefined) {
    if (isArray(v)) {
      segments = [];
      // collapse empty elements within array
      for (var i=0, l=v.length; i < l; i++) {
        if (!v[i].length && (!segments.length || !segments[segments.length -1].length)) {
          continue;
        }

        if (segments.length && !segments[segments.length -1].length) {
          segments.pop();
        }

        segments.push(trimSlashes(v[i]));
      }
    } else if (v || typeof v === 'string') {
      v = trimSlashes(v);
      if (segments[segments.length -1] === '') {
        // empty trailing elements have to be overwritten
        // to prevent results such as /foo//bar
        segments[segments.length -1] = v;
      } else {
        segments.push(v);
      }
    }
  } else {
    if (v) {
      segments[segment] = trimSlashes(v);
    } else {
      segments.splice(segment, 1);
    }
  }

  if (absolute) {
    segments.unshift('');
  }

  return this.path(segments.join(separator), build);
};

// mutating query string
var q = p.query;
p.query = function(v, build) {
  if (v === true) {
    return URI.parseQuery(this._parts.query, this._parts.escapeQuerySpace);
  } else if (typeof v === 'function') {
    var data = URI.parseQuery(this._parts.query, this._parts.escapeQuerySpace);
    var result = v.call(this, data);
    this._parts.query = URI.buildQuery(result || data, this._parts.duplicateQueryParameters, this._parts.escapeQuerySpace);
    this.build(!build);
    return this;
  } else if (v !== undefined && typeof v !== 'string') {
    this._parts.query = URI.buildQuery(v, this._parts.duplicateQueryParameters, this._parts.escapeQuerySpace);
    this.build(!build);
    return this;
  } else {
    return q.call(this, v, build);
  }
};

// state
p.preventInvalidHostname = function(v) {
  this._parts.preventInvalidHostname = !!v;
  return this;
};

p.duplicateQueryParameters = function(v) {
  this._parts.duplicateQueryParameters = !!v;
  return this;
};

p.escapeQuerySpace = function(v) {
  this._parts.escapeQuerySpace = !!v;
  return this;
};
