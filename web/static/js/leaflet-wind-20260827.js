(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('leaflet')) :
  typeof define === 'function' && define.amd ? define(['exports', 'leaflet'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.leafletWind = {}, global.L));
})(this, (function (exports, L) { 'use strict';

  // [海纳 patch] WGS84 → GCJ-02 坐标转换（高德底图是 GCJ-02，粒子位置需转换对齐）
  var PI = 3.1415926535897932384626;
  var a = 6378245.0;
  var ee = 0.00669342162296594323;
  function outOfChina(lng, lat) {
    return (lng < 72.004 || lng > 137.8347) || (lat < 0.8293 || lat > 55.8271);
  }
  function transformLat(x, y) {
    var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
    return ret;
  }
  function transformLng(x, y) {
    var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
  }
  function wgs84ToGcj02(lng, lat) {
    if (outOfChina(lng, lat)) {
      return [lng, lat];
    }
    var dLat = transformLat(lng - 105.0, lat - 35.0);
    var dLng = transformLng(lng - 105.0, lat - 35.0);
    var radLat = lat / 180.0 * PI;
    var magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    var sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);
    return [lng + dLng, lat + dLat];
  }
  // [海纳 patch] GCJ-02 → WGS84（反算，迭代逼近）
  function gcj02ToWgs84(lng, lat) {
    if (outOfChina(lng, lat)) {
      return [lng, lat];
    }
    var wgs_lng = lng, wgs_lat = lat;
    for (var i = 0; i < 20; i++) {
      var gcj = wgs84ToGcj02(wgs_lng, wgs_lat);
      var dLng = gcj[0] - lng;
      var dLat = gcj[1] - lat;
      wgs_lng -= dLng;
      wgs_lat -= dLat;
      if (Math.abs(dLng) < 1e-9 && Math.abs(dLat) < 1e-9) break;
    }
    return [wgs_lng, wgs_lat];
  }

  function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
      Object.keys(e).forEach(function (k) {
        if (k !== 'default') {
          var d = Object.getOwnPropertyDescriptor(e, k);
          Object.defineProperty(n, k, d.get ? d : {
            enumerable: true,
            get: function () { return e[k]; }
          });
        }
      });
    }
    n.default = e;
    return Object.freeze(n);
  }

  var L__namespace = /*#__PURE__*/_interopNamespaceDefault(L);

  const hasOwnProperty = Object.prototype.hasOwnProperty;
  const symToStringTag = typeof Symbol !== "undefined" ? Symbol.toStringTag : void 0;
  function baseGetTag(value) {
    if (value === null) {
      return value === void 0 ? "[object Undefined]" : "[object Null]";
    }
    if (!(symToStringTag && symToStringTag in Object(value))) {
      return toString.call(value);
    }
    const isOwn = hasOwnProperty.call(value, symToStringTag);
    const tag = value[symToStringTag];
    let unmasked = false;
    try {
      value[symToStringTag] = void 0;
      unmasked = true;
    } catch (e) {
    }
    const result = Object.prototype.toString.call(value);
    if (unmasked) {
      if (isOwn) {
        value[symToStringTag] = tag;
      } else {
        delete value[symToStringTag];
      }
    }
    return result;
  }
  function isFunction$1(value) {
    if (!isObject$1(value)) {
      return false;
    }
    const tag = baseGetTag(value);
    return tag === "[object Function]" || tag === "[object AsyncFunction]" || tag === "[object GeneratorFunction]" || tag === "[object Proxy]";
  }
  function isObject$1(value) {
    const type = typeof value;
    return value !== null && (type === "object" || type === "function");
  }
  function isString$1(value) {
    if (value == null) {
      return false;
    }
    return typeof value === "string" || value.constructor !== null && value.constructor === String;
  }
  function isNumber$1(value) {
    return Object.prototype.toString.call(value) === "[object Number]" && !isNaN(value);
  }
  function isArray(arr) {
    return Array.isArray(arr);
  }
  function assign(target, ...sources) {
    return Object.assign(target, ...sources);
  }
  function warnLog(msg, n) {
    console.warn(`${n || "wind-layer"}: ${msg}`);
  }
  const warnings = {};
  function warnOnce(namespaces, msg) {
    if (!warnings[msg]) {
      warnLog(msg, namespaces);
      warnings[msg] = true;
    }
  }
  function floorMod(a, n) {
    return a - n * Math.floor(a / n);
  }
  function isValide(val) {
    return val !== void 0 && val !== null && !isNaN(val);
  }
  function formatData(data, options = {}) {
    let uComp = void 0;
    let vComp = void 0;
    data.forEach(function(record) {
      switch (record.header.parameterCategory + "," + record.header.parameterNumber) {
        case "1,2":
        case "2,2":
          uComp = record;
          break;
        case "1,3":
        case "2,3":
          vComp = record;
          break;
      }
    });
    if (!vComp || !uComp) {
      return void 0;
    }
    const header = uComp.header;
    const vectorField = new Field({
      xmin: header.lo1,
      // 一般格点数据是按照矩形范围来切割，所以定义其经纬度范围
      ymin: header.la1,
      xmax: header.lo2,
      ymax: header.la2,
      deltaX: header.dx,
      // x（经度）增量
      deltaY: header.dy,
      // y（维度）增量
      cols: header.nx,
      // 列（可由 `(xmax - xmin) / deltaX` 得到）
      rows: header.ny,
      // 行
      us: uComp.data,
      // U分量
      vs: vComp.data,
      // V分量
      ...options
    });
    return vectorField;
  }
  function createCanvas(width, height, retina, Canvas) {
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = width * retina;
      canvas.height = height * retina;
      return canvas;
    } else {
      return new Canvas(width * retina, height * retina);
    }
  }
  let Vector$1 = class Vector {
    constructor(u, v) {
      this.u = u;
      this.v = v;
      this.m = this.magnitude();
    }
    /**
     * 向量值（这里指风速）
     * @returns {Number}
     */
    magnitude() {
      return Math.sqrt(this.u ** 2 + this.v ** 2);
    }
    /**
     * 流体方向 （这里指风向，范围为0-360º）
     * N is 0º and E is 90º
     * @returns {Number}
     */
    directionTo() {
      const verticalAngle = Math.atan2(this.u, this.v);
      let inDegrees = verticalAngle * (180 / Math.PI);
      if (inDegrees < 0) {
        inDegrees += 360;
      }
      return inDegrees;
    }
    /**
     * Angle in degrees (0 to 360º) From x-->
     * N is 0º and E is 90º
     * @returns {Number}
     */
    directionFrom() {
      const a = this.directionTo();
      return (a + 180) % 360;
    }
  };
  class Field {
    constructor(params) {
      this.grid = [];
      this.xmin = params.xmin;
      this.xmax = params.xmax;
      this.ymin = params.ymin;
      this.ymax = params.ymax;
      this.cols = params.cols;
      this.rows = params.rows;
      this.us = params.us;
      this.vs = params.vs;
      this.deltaX = params.deltaX;
      this.deltaY = params.deltaY;
      this.flipY = Boolean(params.flipY);
      this.ymin = Math.min(params.ymax, params.ymin);
      this.ymax = Math.max(params.ymax, params.ymin);
      if (!(this.deltaY < 0 && this.ymin < this.ymax)) {
        if (params.flipY === void 0) {
          this.flipY = true;
        }
        console.warn("[wind-core]: The data is flipY");
      }
      this.isFields = true;
      const cols = Math.ceil((this.xmax - this.xmin) / params.deltaX);
      const rows = Math.ceil((this.ymax - this.ymin) / params.deltaY);
      if (cols !== this.cols || rows !== this.rows) {
        console.warn("[wind-core]: The data grid not equal");
      }
      this.isContinuous = Math.floor(this.cols * params.deltaX) >= 360;
      this.translateX = "translateX" in params ? params.translateX : this.xmax > 180;
      if ("wrappedX" in params) {
        warnOnce("[wind-core]: ", "`wrappedX` namespace will deprecated please use `translateX` instead\uFF01");
      }
      this.wrapX = Boolean(params.wrapX);
      this.grid = this.buildGrid();
      this.range = this.calculateRange();
    }
    // from https://github.com/sakitam-fdd/wind-layer/blob/95368f9433/src/windy/windy.js#L110
    buildGrid() {
      const grid = [];
      let p = 0;
      const { rows, cols, us, vs } = this;
      for (let j = 0; j < rows; j++) {
        const row = [];
        for (let i = 0; i < cols; i++, p++) {
          const u = us[p];
          const v = vs[p];
          const valid = this.isValid(u) && this.isValid(v);
          row[i] = valid ? new Vector$1(u, v) : null;
        }
        if (this.isContinuous) {
          row.push(row[0]);
        }
        grid[j] = row;
      }
      return grid;
    }
    /**
     * release data
     */
    release() {
      this.grid = [];
    }
    /**
     * grib data extent
     * 格点数据范围
     */
    extent() {
      return [this.xmin, this.ymin, this.xmax, this.ymax];
    }
    /**
     * Bilinear interpolation for Vector
     * 针对向量进行双线性插值
     * https://en.wikipedia.org/wiki/Bilinear_interpolation
     * @param   {Number} x
     * @param   {Number} y
     * @param   {Number[]} g00
     * @param   {Number[]} g10
     * @param   {Number[]} g01
     * @param   {Number[]} g11
     * @returns {Vector}
     */
    bilinearInterpolateVector(x, y, g00, g10, g01, g11) {
      const rx = 1 - x;
      const ry = 1 - y;
      const a = rx * ry;
      const b = x * ry;
      const c = rx * y;
      const d = x * y;
      const u = g00.u * a + g10.u * b + g01.u * c + g11.u * d;
      const v = g00.v * a + g10.v * b + g01.v * c + g11.v * d;
      return new Vector$1(u, v);
    }
    /**
     * calculate vector value range
     */
    calculateRange() {
      if (!this.grid || !this.grid[0])
        return;
      const rows = this.grid.length;
      const cols = this.grid[0].length;
      let min;
      let max;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const vec = this.grid[j][i];
          if (vec !== null) {
            const val = vec.m || vec.magnitude();
            if (min === void 0) {
              min = val;
            } else if (max === void 0) {
              max = val;
              min = Math.min(min, max);
              max = Math.max(min, max);
            } else {
              min = Math.min(val, min);
              max = Math.max(val, max);
            }
          }
        }
      }
      return [min, max];
    }
    /**
     * 检查 uv是否合法
     * @param x
     * @private
     */
    isValid(x) {
      return x !== null && x !== void 0;
    }
    getWrappedLongitudes() {
      let xmin = this.xmin;
      let xmax = this.xmax;
      if (this.translateX) {
        if (this.isContinuous) {
          xmin = -180;
          xmax = 180;
        } else {
          xmax = this.xmax - 360;
          xmin = this.xmin - 360;
        }
      }
      return [xmin, xmax];
    }
    contains(lon, lat) {
      const [xmin, xmax] = this.getWrappedLongitudes();
      if (xmax > 180 && lon >= -180 && lon <= xmax - 360) {
        lon += 360;
      } else if (xmin < -180 && lon <= 180 && lon >= xmin + 360) {
        lon -= 360;
      }
      const longitudeIn = lon >= xmin && lon <= xmax;
      let latitudeIn;
      if (this.deltaY >= 0) {
        latitudeIn = lat >= this.ymin && lat <= this.ymax;
      } else {
        latitudeIn = lat >= this.ymax && lat <= this.ymin;
      }
      return longitudeIn && latitudeIn;
    }
    /**
     * 获取经纬度所在的位置索引
     * @param lon
     * @param lat
     */
    getDecimalIndexes(lon, lat) {
      const i = floorMod(lon - this.xmin, 360) / this.deltaX;
      if (this.flipY) {
        const j = (this.ymax - lat) / this.deltaY;
        return [i, j];
      } else {
        const j = (this.ymin + lat) / this.deltaY;
        return [i, j];
      }
    }
    /**
     * Nearest value at lon-lat coordinates
     * 线性插值
     * @param lon
     * @param lat
     */
    valueAt(lon, lat) {
      let flag = false;
      if (this.wrapX) {
        flag = true;
      } else if (this.contains(lon, lat)) {
        flag = true;
      }
      if (!flag)
        return null;
      const indexes = this.getDecimalIndexes(lon, lat);
      const ii = Math.floor(indexes[0]);
      const jj = Math.floor(indexes[1]);
      const ci = this.clampColumnIndex(ii);
      const cj = this.clampRowIndex(jj);
      return this.valueAtIndexes(ci, cj);
    }
    /**
     * Get interpolated grid value lon-lat coordinates
     * 双线性插值
     * @param lon
     * @param lat
     */
    interpolatedValueAt(lon, lat) {
      let flag = false;
      if (this.wrapX) {
        flag = true;
      } else if (this.contains(lon, lat)) {
        flag = true;
      }
      if (!flag)
        return null;
      const [i, j] = this.getDecimalIndexes(lon, lat);
      return this.interpolatePoint(i, j);
    }
    hasValueAt(lon, lat) {
      const value = this.valueAt(lon, lat);
      return value !== null;
    }
    /**
     * 基于向量的双线性插值
     * @param i
     * @param j
     */
    interpolatePoint(i, j) {
      const indexes = this.getFourSurroundingIndexes(i, j);
      const [fi, ci, fj, cj] = indexes;
      const values = this.getFourSurroundingValues(fi, ci, fj, cj);
      if (values) {
        const [g00, g10, g01, g11] = values;
        return this.bilinearInterpolateVector(i - fi, j - fj, g00, g10, g01, g11);
      }
      return null;
    }
    /**
     * Check the column index is inside the field,
     * adjusting to min or max when needed
     * @private
     * @param   {Number} ii - index
     * @returns {Number} i - inside the allowed indexes
     */
    clampColumnIndex(ii) {
      let i = ii;
      if (ii < 0) {
        i = 0;
      }
      const maxCol = this.cols - 1;
      if (ii > maxCol) {
        i = maxCol;
      }
      return i;
    }
    /**
     * Check the row index is inside the field,
     * adjusting to min or max when needed
     * @private
     * @param   {Number} jj index
     * @returns {Number} j - inside the allowed indexes
     */
    clampRowIndex(jj) {
      let j = jj;
      if (jj < 0) {
        j = 0;
      }
      const maxRow = this.rows - 1;
      if (jj > maxRow) {
        j = maxRow;
      }
      return j;
    }
    /**
     * 计算索引位置周围的数据
     * @private
     * @param   {Number} i - decimal index
     * @param   {Number} j - decimal index
     * @returns {Array} [fi, ci, fj, cj]
     */
    getFourSurroundingIndexes(i, j) {
      const fi = Math.floor(i);
      let ci = fi + 1;
      if (this.isContinuous && ci >= this.cols) {
        ci = 0;
      }
      ci = this.clampColumnIndex(ci);
      const fj = this.clampRowIndex(Math.floor(j));
      const cj = this.clampRowIndex(fj + 1);
      return [fi, ci, fj, cj];
    }
    /**
     * Get four surrounding values or null if not available,
     * from 4 integer indexes
     * @private
     * @param   {Number} fi
     * @param   {Number} ci
     * @param   {Number} fj
     * @param   {Number} cj
     * @returns {Array}
     */
    getFourSurroundingValues(fi, ci, fj, cj) {
      let row;
      if (row = this.grid[fj]) {
        const g00 = row[fi];
        const g10 = row[ci];
        if (this.isValid(g00) && this.isValid(g10) && (row = this.grid[cj])) {
          const g01 = row[fi];
          const g11 = row[ci];
          if (this.isValid(g01) && this.isValid(g11)) {
            return [g00, g10, g01, g11];
          }
        }
      }
      return null;
    }
    /**
     * Value for grid indexes
     * @param   {Number} i - column index (integer)
     * @param   {Number} j - row index (integer)
     * @returns {Vector|Number}
     */
    valueAtIndexes(i, j) {
      return this.grid[j][i];
    }
    /**
     * Lon-Lat for grid indexes
     * @param   {Number} i - column index (integer)
     * @param   {Number} j - row index (integer)
     * @returns {Number[]} [lon, lat]
     */
    lonLatAtIndexes(i, j) {
      const lon = this.longitudeAtX(i);
      const lat = this.latitudeAtY(j);
      return [lon, lat];
    }
    /**
     * Longitude for grid-index
     * @param   {Number} i - column index (integer)
     * @returns {Number} longitude at the center of the cell
     */
    longitudeAtX(i) {
      const halfXPixel = this.deltaX / 2;
      let lon = this.xmin + halfXPixel + i * this.deltaX;
      if (this.translateX) {
        lon = lon > 180 ? lon - 360 : lon;
      }
      return lon;
    }
    /**
     * Latitude for grid-index
     * @param   {Number} j - row index (integer)
     * @returns {Number} latitude at the center of the cell
     */
    latitudeAtY(j) {
      const halfYPixel = this.deltaY / 2;
      return this.ymax - halfYPixel - j * this.deltaY;
    }
    /**
     * 生成粒子位置
     * @param o
     * @param width
     * @param height
     * @param unproject
     * @return IPosition
     */
    randomize(o = {}, width, height, unproject) {
      // [海纳 patch] 调试：打印粒子经纬度
      if (window._dbgCount === undefined) window._dbgCount = 0;
      const i = Math.random() * (width || this.cols) | 0;
      const j = Math.random() * (height || this.rows) | 0;
      const coords = unproject([i, j]);
      if (coords !== null) {
        o.x = coords[0];
        o.y = coords[1];
      } else {
        o.x = this.longitudeAtX(i);
        o.y = this.latitudeAtY(j);
      }
      return o;
    }
    /**
     * 判断是否是 `Field` 的实例
     * @return boolean
     */
    checkFields() {
      return this.isFields;
    }
  }
  const defaultOptions$2 = {
    globalAlpha: 0.9,
    // 全局透明度
    lineWidth: 1,
    // 线条宽度
    colorScale: "#fff",
    velocityScale: 1 / 25,
    // particleAge: 90,
    maxAge: 90,
    // alias for particleAge
    // particleMultiplier: 1 / 300, // TODO: PATHS = Math.round(width * height * particleMultiplier);
    paths: 800,
    frameRate: 20,
    useCoordsDraw: true
  };
  function indexFor(m, min, max, colorScale) {
    return Math.max(0, Math.min(colorScale.length - 1, Math.round((m - min) / (max - min) * (colorScale.length - 1))));
  }
  class WindCore {
    constructor(ctx, options, field) {
      this.particles = [];
      this.generated = false;
      this.ctx = ctx;
      if (!this.ctx) {
        throw new Error("ctx error");
      }
      this.animate = this.animate.bind(this);
      this.setOptions(options);
      if (field) {
        this.updateData(field);
      }
    }
    static {
      this.Field = Field;
    }
    /**
     * 设置配置项
     * @param options
     */
    setOptions(options) {
      this.options = { ...defaultOptions$2, ...options };
      const { width, height } = this.ctx.canvas;
      if ("particleAge" in options && !("maxAge" in options) && isNumber$1(this.options.particleAge)) {
        this.options.maxAge = this.options.particleAge;
      }
      if ("particleMultiplier" in options && !("paths" in options) && isNumber$1(this.options.particleMultiplier)) {
        this.options.paths = Math.round(width * height * this.options.particleMultiplier);
      }
      this.prerender();
    }
    /**
     * 获取配置项
     */
    getOptions() {
      return this.options;
    }
    /**
     * 更新数据
     * @param field
     */
    updateData(field) {
      this.field = field;
      if (!this.generated) {
        return;
      }
      this.particles = this.prepareParticlePaths();
    }
    // @ts-ignore
    project(...args) {
      throw new Error("project must be overriden");
    }
    // @ts-ignore
    unproject(...args) {
      throw new Error("unproject must be overriden");
    }
    /**
     * 判断位置是否在当前视窗内
     * @param coordinates
     */
    intersectsCoordinate(coordinates) {
      throw new Error("must be overriden");
    }
    /**
     * 清空当前画布
     */
    clearCanvas() {
      this.stop();
      this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
      this.forceStop = false;
    }
    isStop() {
      return !this.starting;
    }
    /**
     * 启动粒子动画
     */
    start() {
      this.starting = true;
      this.forceStop = false;
      this.then = Date.now();
      this.animate();
    }
    /**
     * 停止粒子动画
     */
    stop() {
      cancelAnimationFrame(this.animationLoop);
      this.starting = false;
      this.forceStop = true;
    }
    animate() {
      if (this.animationLoop) {
        cancelAnimationFrame(this.animationLoop);
      }
      this.animationLoop = requestAnimationFrame(this.animate);
      const now = Date.now();
      const delta = now - this.then;
      if (delta > this.options.frameRate) {
        this.then = now - delta % this.options.frameRate;
        this.render();
      }
    }
    /**
     * 渲染前处理
     */
    prerender() {
      this.generated = false;
      if (!this.field) {
        return;
      }
      this.particles = this.prepareParticlePaths();
      this.generated = true;
      if (!this.starting && !this.forceStop) {
        this.starting = true;
        this.then = Date.now();
        this.animate();
      }
    }
    /**
     * 开始渲染
     */
    render() {
      this.moveParticles();
      this.drawParticles();
      this.postrender();
    }
    /**
     * each frame render end
     */
    postrender() {
    }
    moveParticles() {
      const { width, height } = this.ctx.canvas;
      const particles = this.particles;
      const maxAge = this.options.maxAge;
      const velocityScale = isFunction$1(this.options.velocityScale) ? this.options.velocityScale() : this.options.velocityScale;
      let i = 0;
      const len = particles.length;
      for (; i < len; i++) {
        const particle = particles[i];
        if (particle.age > maxAge) {
          particle.age = 0;
          this.field.randomize(particle, width, height, this.unproject);
        }
        const x = particle.x;
        const y = particle.y;
        const vector = this.field.interpolatedValueAt(x, y);
        if (vector === null) {
          particle.age = maxAge;
        } else {
          const xt = x + vector.u * velocityScale;
          const yt = y + vector.v * velocityScale;
          if (this.field.hasValueAt(xt, yt)) {
            particle.xt = xt;
            particle.yt = yt;
            particle.m = vector.m;
          } else {
            particle.x = xt;
            particle.y = yt;
            particle.age = maxAge;
          }
        }
        particle.age++;
      }
    }
    fadeIn() {
      const prev = this.ctx.globalCompositeOperation;
      this.ctx.globalCompositeOperation = "destination-in";
      this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
      this.ctx.globalCompositeOperation = prev;
    }
    drawParticles() {
      const particles = this.particles;
      this.fadeIn();
      this.ctx.globalAlpha = this.options.globalAlpha;
      this.ctx.fillStyle = `rgba(0, 0, 0, ${this.options.globalAlpha})`;
      this.ctx.lineWidth = isNumber$1(this.options.lineWidth) ? this.options.lineWidth : 1;
      this.ctx.strokeStyle = isString$1(this.options.colorScale) ? this.options.colorScale : "#fff";
      let i = 0;
      const len = particles.length;
      if (this.field && len > 0) {
        let min;
        let max;
        if (isValide(this.options.minVelocity) && isValide(this.options.maxVelocity)) {
          min = this.options.minVelocity;
          max = this.options.maxVelocity;
        } else {
          [min, max] = this.field.range;
        }
        for (; i < len; i++) {
          this[this.options.useCoordsDraw ? "drawCoordsParticle" : "drawPixelParticle"](particles[i], min, max);
        }
      }
    }
    /**
     * 用于绘制像素粒子
     * @param particle
     * @param min
     * @param max
     */
    drawPixelParticle(particle, min, max) {
      const pointPrev = [particle.x, particle.y];
      const pointNext = [particle.xt, particle.yt];
      if (pointNext && pointPrev && isValide(pointNext[0]) && isValide(pointNext[1]) && isValide(pointPrev[0]) && isValide(pointPrev[1]) && particle.age <= this.options.maxAge) {
        this.ctx.beginPath();
        this.ctx.moveTo(pointPrev[0], pointPrev[1]);
        this.ctx.lineTo(pointNext[0], pointNext[1]);
        if (isFunction$1(this.options.colorScale)) {
          this.ctx.strokeStyle = this.options.colorScale(particle.m);
        } else if (Array.isArray(this.options.colorScale)) {
          const colorIdx = indexFor(particle.m, min, max, this.options.colorScale);
          this.ctx.strokeStyle = this.options.colorScale[colorIdx];
        }
        if (isFunction$1(this.options.lineWidth)) {
          this.ctx.lineWidth = this.options.lineWidth(particle.m);
        }
        particle.x = particle.xt;
        particle.y = particle.yt;
        this.ctx.stroke();
      }
    }
    /**
     * 用于绘制坐标粒子
     * @param particle
     * @param min
     * @param max
     */
    drawCoordsParticle(particle, min, max) {
      const source = [particle.x, particle.y];
      const target = [particle.xt, particle.yt];
      if (target && source && isValide(target[0]) && isValide(target[1]) && isValide(source[0]) && isValide(source[1]) && this.intersectsCoordinate(target) && particle.age <= this.options.maxAge) {
        const pointPrev = this.project(source);
        const pointNext = this.project(target);
        if (pointPrev && pointNext) {
          this.ctx.beginPath();
          this.ctx.moveTo(pointPrev[0], pointPrev[1]);
          this.ctx.lineTo(pointNext[0], pointNext[1]);
          particle.x = particle.xt;
          particle.y = particle.yt;
          if (isFunction$1(this.options.colorScale)) {
            this.ctx.strokeStyle = this.options.colorScale(particle.m);
          } else if (Array.isArray(this.options.colorScale)) {
            const colorIdx = indexFor(particle.m, min, max, this.options.colorScale);
            this.ctx.strokeStyle = this.options.colorScale[colorIdx];
          }
          if (isFunction$1(this.options.lineWidth)) {
            this.ctx.lineWidth = this.options.lineWidth(particle.m);
          }
          this.ctx.stroke();
        }
      }
    }
    prepareParticlePaths() {
      const { width, height } = this.ctx.canvas;
      // [海纳 patch] 调试：打印 canvas 尺寸
      const particleCount = typeof this.options.paths === "function" ? this.options.paths(this) : this.options.paths;
      const particles = [];
      if (!this.field) {
        return [];
      }
      let i = 0;
      for (; i < particleCount; i++) {
        particles.push(
          this.field.randomize(
            {
              age: this.randomize()
            },
            width,
            height,
            this.unproject
          )
        );
      }
      return particles;
    }
    randomize() {
      return Math.floor(Math.random() * this.options.maxAge);
    }
  }

  /**
   * Common utilities
   * @module glMatrix
   */
  // Configuration Constants
  var EPSILON = 0.000001;
  var ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
  /**
   * Sets the type of array used when creating new vectors and matrices
   *
   * @param {Float32ArrayConstructor | ArrayConstructor} type Array type, such as Float32Array or Array
   */

  function setMatrixArrayType(type) {
    ARRAY_TYPE = type;
  }
  if (!Math.hypot) Math.hypot = function () {
    var y = 0,
        i = arguments.length;

    while (i--) {
      y += arguments[i] * arguments[i];
    }

    return Math.sqrt(y);
  };

  /**
   * 3x3 Matrix
   * @module mat3
   */

  /**
   * Creates a new identity mat3
   *
   * @returns {mat3} a new 3x3 matrix
   */

  function create$4() {
    var out = new ARRAY_TYPE(9);

    if (ARRAY_TYPE != Float32Array) {
      out[1] = 0;
      out[2] = 0;
      out[3] = 0;
      out[5] = 0;
      out[6] = 0;
      out[7] = 0;
    }

    out[0] = 1;
    out[4] = 1;
    out[8] = 1;
    return out;
  }
  /**
   * Copies the upper-left 3x3 values into the given mat3.
   *
   * @param {mat3} out the receiving 3x3 matrix
   * @param {ReadonlyMat4} a   the source 4x4 matrix
   * @returns {mat3} out
   */

  function fromMat4(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[4];
    out[4] = a[5];
    out[5] = a[6];
    out[6] = a[8];
    out[7] = a[9];
    out[8] = a[10];
    return out;
  }
  /**
   * Copy the values from one mat3 to another
   *
   * @param {mat3} out the receiving matrix
   * @param {ReadonlyMat3} a the source matrix
   * @returns {mat3} out
   */

  function copy$3(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return out;
  }
  /**
   * Set the components of a mat3 to the given values
   *
   * @param {mat3} out the receiving matrix
   * @param {Number} m00 Component in column 0, row 0 position (index 0)
   * @param {Number} m01 Component in column 0, row 1 position (index 1)
   * @param {Number} m02 Component in column 0, row 2 position (index 2)
   * @param {Number} m10 Component in column 1, row 0 position (index 3)
   * @param {Number} m11 Component in column 1, row 1 position (index 4)
   * @param {Number} m12 Component in column 1, row 2 position (index 5)
   * @param {Number} m20 Component in column 2, row 0 position (index 6)
   * @param {Number} m21 Component in column 2, row 1 position (index 7)
   * @param {Number} m22 Component in column 2, row 2 position (index 8)
   * @returns {mat3} out
   */

  function set$4(out, m00, m01, m02, m10, m11, m12, m20, m21, m22) {
    out[0] = m00;
    out[1] = m01;
    out[2] = m02;
    out[3] = m10;
    out[4] = m11;
    out[5] = m12;
    out[6] = m20;
    out[7] = m21;
    out[8] = m22;
    return out;
  }
  /**
   * Set a mat3 to the identity matrix
   *
   * @param {mat3} out the receiving matrix
   * @returns {mat3} out
   */

  function identity$1(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 1;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 1;
    return out;
  }
  /**
   * Transpose the values of a mat3
   *
   * @param {mat3} out the receiving matrix
   * @param {ReadonlyMat3} a the source matrix
   * @returns {mat3} out
   */

  function transpose$1(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
      var a01 = a[1],
          a02 = a[2],
          a12 = a[5];
      out[1] = a[3];
      out[2] = a[6];
      out[3] = a01;
      out[5] = a[7];
      out[6] = a02;
      out[7] = a12;
    } else {
      out[0] = a[0];
      out[1] = a[3];
      out[2] = a[6];
      out[3] = a[1];
      out[4] = a[4];
      out[5] = a[7];
      out[6] = a[2];
      out[7] = a[5];
      out[8] = a[8];
    }

    return out;
  }
  /**
   * Inverts a mat3
   *
   * @param {mat3} out the receiving matrix
   * @param {ReadonlyMat3} a the source matrix
   * @returns {mat3} out
   */

  function invert$2(out, a) {
    var a00 = a[0],
        a01 = a[1],
        a02 = a[2];
    var a10 = a[3],
        a11 = a[4],
        a12 = a[5];
    var a20 = a[6],
        a21 = a[7],
        a22 = a[8];
    var b01 = a22 * a11 - a12 * a21;
    var b11 = -a22 * a10 + a12 * a20;
    var b21 = a21 * a10 - a11 * a20; // Calculate the determinant

    var det = a00 * b01 + a01 * b11 + a02 * b21;

    if (!det) {
      return null;
    }

    det = 1.0 / det;
    out[0] = b01 * det;
    out[1] = (-a22 * a01 + a02 * a21) * det;
    out[2] = (a12 * a01 - a02 * a11) * det;
    out[3] = b11 * det;
    out[4] = (a22 * a00 - a02 * a20) * det;
    out[5] = (-a12 * a00 + a02 * a10) * det;
    out[6] = b21 * det;
    out[7] = (-a21 * a00 + a01 * a20) * det;
    out[8] = (a11 * a00 - a01 * a10) * det;
    return out;
  }
  /**
   * Calculates the adjugate of a mat3
   *
   * @param {mat3} out the receiving matrix
   * @param {ReadonlyMat3} a the source matrix
   * @returns {mat3} out
   */

  function adjoint$1(out, a) {
    var a00 = a[0],
        a01 = a[1],
        a02 = a[2];
    var a10 = a[3],
        a11 = a[4],
        a12 = a[5];
    var a20 = a[6],
        a21 = a[7],
        a22 = a[8];
    out[0] = a11 * a22 - a12 * a21;
    out[1] = a02 * a21 - a01 * a22;
    out[2] = a01 * a12 - a02 * a11;
    out[3] = a12 * a20 - a10 * a22;
    out[4] = a00 * a22 - a02 * a20;
    out[5] = a02 * a10 - a00 * a12;
    out[6] = a10 * a21 - a11 * a20;
    out[7] = a01 * a20 - a00 * a21;
    out[8] = a00 * a11 - a01 * a10;
    return out;
  }
  /**
   * Calculates the determinant of a mat3
   *
   * @param {ReadonlyMat3} a the source matrix
   * @returns {Number} determinant of a
   */

  function determinant$1(a) {
    var a00 = a[0],
        a01 = a[1],
        a02 = a[2];
    var a10 = a[3],
        a11 = a[4],
        a12 = a[5];
    var a20 = a[6],
        a21 = a[7],
        a22 = a[8];
    return a00 * (a22 * a11 - a12 * a21) + a01 * (-a22 * a10 + a12 * a20) + a02 * (a21 * a10 - a11 * a20);
  }
  /**
   * Multiplies two mat3's
   *
   * @param {mat3} out the receiving matrix
   * @param {ReadonlyMat3} a the first operand
   * @param {ReadonlyMat3} b the second operand
   * @returns {mat3} out
   */

  function multiply$5(out, a, b) {
    var a00 = a[0],
        a01 = a[1],
        a02 = a[2];
    var a10 = a[3],
        a11 = a[4],
        a12 = a[5];
    var a20 = a[6],
        a21 = a[7],
        a22 = a[8];
    var b00 = b[0],
        b01 = b[1],
        b02 = b[2];
    var b10 = b[3],
        b11 = b[4],
        b12 = b[5];
    var b20 = b[6],
        b21 = b[7],
        b22 = b[8];
    out[0] = b00 * a00 + b01 * a10 + b02 * a20;
    out[1] = b00 * a01 + b01 * a11 + b02 * a21;
    out[2] = b00 * a02 + b01 * a12 + b02 * a22;
    out[3] = b10 * a00 + b11 * a10 + b12 * a20;
    out[4] = b10 * a01 + b11 * a11 + b12 * a21;
    out[5] = b10 * a02 + b11 * a12 + b12 * a22;
    out[6] = b20 * a00 + b21 * a10 + b22 * a20;
    out[7] = b20 * a01 + b21 * a11 + b22 * a21;
    out[8] = b20 * a02 + b21 * a12 + b22 * a22;
    return out;
  }
  /**
   * Translate a mat3 by the given vector
   *
   * @param {mat3} out the receiving matrix
   * @param {ReadonlyMat3} a the matrix to translate
   * @param {ReadonlyVec2} v vector to translate by
   * @returns {mat3} out
   */

  function translate$1(out, a, v) {
    var a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a10 = a[3],
        a11 = a[4],
        a12 = a[5],
        a20 = a[6],
        a21 = a[7],
        a22 = a[8],
        x = v[0],
        y = v[1];
    out[0] = a00;
    out[1] = a01;
    out[2] = a02;
    out[3] = a10;
    out[4] = a11;
    out[5] = a12;
    out[6] = x * a00 + y * a10 + a20;
    out[7] = x * a01 + y * a11 + a21;
    out[8] = x * a02 + y * a12 + a22;
    return out;
  }
  /**
   * Rotates a mat3 by the given angle
   *
   * @param {mat3} out the receiving matrix
   * @param {ReadonlyMat3} a the matrix to rotate
   * @param {Number} rad the angle to rotate the matrix by
   * @returns {mat3} out
   */

  function rotate$1(out, a, rad) {
    var a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a10 = a[3],
        a11 = a[4],
        a12 = a[5],
        a20 = a[6],
        a21 = a[7],
        a22 = a[8],
        s = Math.sin(rad),
        c = Math.cos(rad);
    out[0] = c * a00 + s * a10;
    out[1] = c * a01 + s * a11;
    out[2] = c * a02 + s * a12;
    out[3] = c * a10 - s * a00;
    out[4] = c * a11 - s * a01;
    out[5] = c * a12 - s * a02;
    out[6] = a20;
    out[7] = a21;
    out[8] = a22;
    return out;
  }
  /**
   * Scales the mat3 by the dimensions in the given vec2
   *
   * @param {mat3} out the receiving matrix
   * @param {ReadonlyMat3} a the matrix to rotate
   * @param {ReadonlyVec2} v the vec2 to scale the matrix by
   * @returns {mat3} out
   **/

  function scale$4(out, a, v) {
    var x = v[0],
        y = v[1];
    out[0] = x * a[0];
    out[1] = x * a[1];
    out[2] = x * a[2];
    out[3] = y * a[3];
    out[4] = y * a[4];
    out[5] = y * a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return out;
  }
  /**
   * Creates a matrix from a vector translation
   * This is equivalent to (but much faster than):
   *
   *     mat3.identity(dest);
   *     mat3.translate(dest, dest, vec);
   *
   * @param {mat3} out mat3 receiving operation result
   * @param {ReadonlyVec2} v Translation vector
   * @returns {mat3} out
   */

  function fromTranslation$1(out, v) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 1;
    out[5] = 0;
    out[6] = v[0];
    out[7] = v[1];
    out[8] = 1;
    return out;
  }
  /**
   * Creates a matrix from a given angle
   * This is equivalent to (but much faster than):
   *
   *     mat3.identity(dest);
   *     mat3.rotate(dest, dest, rad);
   *
   * @param {mat3} out mat3 receiving operation result
   * @param {Number} rad the angle to rotate the matrix by
   * @returns {mat3} out
   */

  function fromRotation$1(out, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad);
    out[0] = c;
    out[1] = s;
    out[2] = 0;
    out[3] = -s;
    out[4] = c;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 1;
    return out;
  }
  /**
   * Creates a matrix from a vector scaling
   * This is equivalent to (but much faster than):
   *
   *     mat3.identity(dest);
   *     mat3.scale(dest, dest, vec);
   *
   * @param {mat3} out mat3 receiving operation result
   * @param {ReadonlyVec2} v Scaling vector
   * @returns {mat3} out
   */

  function fromScaling$1(out, v) {
    out[0] = v[0];
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = v[1];
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 1;
    return out;
  }
  /**
   * Calculates a 3x3 matrix from the given quaternion
   *
   * @param {mat3} out mat3 receiving operation result
   * @param {ReadonlyQuat} q Quaternion to create matrix from
   *
   * @returns {mat3} out
   */

  function fromQuat$1(out, q) {
    var x = q[0],
        y = q[1],
        z = q[2],
        w = q[3];
    var x2 = x + x;
    var y2 = y + y;
    var z2 = z + z;
    var xx = x * x2;
    var yx = y * x2;
    var yy = y * y2;
    var zx = z * x2;
    var zy = z * y2;
    var zz = z * z2;
    var wx = w * x2;
    var wy = w * y2;
    var wz = w * z2;
    out[0] = 1 - yy - zz;
    out[3] = yx - wz;
    out[6] = zx + wy;
    out[1] = yx + wz;
    out[4] = 1 - xx - zz;
    out[7] = zy - wx;
    out[2] = zx - wy;
    out[5] = zy + wx;
    out[8] = 1 - xx - yy;
    return out;
  }
  /**
   * Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix
   *
   * @param {mat3} out mat3 receiving operation result
   * @param {ReadonlyMat4} a Mat4 to derive the normal matrix from
   *
   * @returns {mat3} out
   */

  function normalFromMat4(out, a) {
    var a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3];
    var a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];
    var a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];
    var a30 = a[12],
        a31 = a[13],
        a32 = a[14],
        a33 = a[15];
    var b00 = a00 * a11 - a01 * a10;
    var b01 = a00 * a12 - a02 * a10;
    var b02 = a00 * a13 - a03 * a10;
    var b03 = a01 * a12 - a02 * a11;
    var b04 = a01 * a13 - a03 * a11;
    var b05 = a02 * a13 - a03 * a12;
    var b06 = a20 * a31 - a21 * a30;
    var b07 = a20 * a32 - a22 * a30;
    var b08 = a20 * a33 - a23 * a30;
    var b09 = a21 * a32 - a22 * a31;
    var b10 = a21 * a33 - a23 * a31;
    var b11 = a22 * a33 - a23 * a32; // Calculate the determinant

    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) {
      return null;
    }

    det = 1.0 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    return out;
  }
  /**
   * Returns Frobenius norm of a mat3
   *
   * @param {ReadonlyMat3} a the matrix to calculate Frobenius norm of
   * @returns {Number} Frobenius norm
   */

  function frob(a) {
    return Math.hypot(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]);
  }
  /**
   * Adds two mat3's
   *
   * @param {mat3} out the receiving matrix
   * @param {ReadonlyMat3} a the first operand
   * @param {ReadonlyMat3} b the second operand
   * @returns {mat3} out
   */

  function add$4(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    out[3] = a[3] + b[3];
    out[4] = a[4] + b[4];
    out[5] = a[5] + b[5];
    out[6] = a[6] + b[6];
    out[7] = a[7] + b[7];
    out[8] = a[8] + b[8];
    return out;
  }
  /**
   * Subtracts matrix b from matrix a
   *
   * @param {mat3} out the receiving matrix
   * @param {ReadonlyMat3} a the first operand
   * @param {ReadonlyMat3} b the second operand
   * @returns {mat3} out
   */

  function subtract$4(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    out[3] = a[3] - b[3];
    out[4] = a[4] - b[4];
    out[5] = a[5] - b[5];
    out[6] = a[6] - b[6];
    out[7] = a[7] - b[7];
    out[8] = a[8] - b[8];
    return out;
  }
  /**
   * Returns whether or not the matrices have approximately the same elements in the same position.
   *
   * @param {ReadonlyMat3} a The first matrix.
   * @param {ReadonlyMat3} b The second matrix.
   * @returns {Boolean} True if the matrices are equal, false otherwise.
   */

  function equals$5(a, b) {
    var a0 = a[0],
        a1 = a[1],
        a2 = a[2],
        a3 = a[3],
        a4 = a[4],
        a5 = a[5],
        a6 = a[6],
        a7 = a[7],
        a8 = a[8];
    var b0 = b[0],
        b1 = b[1],
        b2 = b[2],
        b3 = b[3],
        b4 = b[4],
        b5 = b[5],
        b6 = b[6],
        b7 = b[7],
        b8 = b[8];
    return Math.abs(a0 - b0) <= EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON * Math.max(1.0, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON * Math.max(1.0, Math.abs(a3), Math.abs(b3)) && Math.abs(a4 - b4) <= EPSILON * Math.max(1.0, Math.abs(a4), Math.abs(b4)) && Math.abs(a5 - b5) <= EPSILON * Math.max(1.0, Math.abs(a5), Math.abs(b5)) && Math.abs(a6 - b6) <= EPSILON * Math.max(1.0, Math.abs(a6), Math.abs(b6)) && Math.abs(a7 - b7) <= EPSILON * Math.max(1.0, Math.abs(a7), Math.abs(b7)) && Math.abs(a8 - b8) <= EPSILON * Math.max(1.0, Math.abs(a8), Math.abs(b8));
  }

  /**
   * Copy the values from one mat4 to another
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the source matrix
   * @returns {mat4} out
   */

  function copy$2(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
  }
  /**
   * Set the components of a mat4 to the given values
   *
   * @param {mat4} out the receiving matrix
   * @param {Number} m00 Component in column 0, row 0 position (index 0)
   * @param {Number} m01 Component in column 0, row 1 position (index 1)
   * @param {Number} m02 Component in column 0, row 2 position (index 2)
   * @param {Number} m03 Component in column 0, row 3 position (index 3)
   * @param {Number} m10 Component in column 1, row 0 position (index 4)
   * @param {Number} m11 Component in column 1, row 1 position (index 5)
   * @param {Number} m12 Component in column 1, row 2 position (index 6)
   * @param {Number} m13 Component in column 1, row 3 position (index 7)
   * @param {Number} m20 Component in column 2, row 0 position (index 8)
   * @param {Number} m21 Component in column 2, row 1 position (index 9)
   * @param {Number} m22 Component in column 2, row 2 position (index 10)
   * @param {Number} m23 Component in column 2, row 3 position (index 11)
   * @param {Number} m30 Component in column 3, row 0 position (index 12)
   * @param {Number} m31 Component in column 3, row 1 position (index 13)
   * @param {Number} m32 Component in column 3, row 2 position (index 14)
   * @param {Number} m33 Component in column 3, row 3 position (index 15)
   * @returns {mat4} out
   */

  function set$3(out, m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33) {
    out[0] = m00;
    out[1] = m01;
    out[2] = m02;
    out[3] = m03;
    out[4] = m10;
    out[5] = m11;
    out[6] = m12;
    out[7] = m13;
    out[8] = m20;
    out[9] = m21;
    out[10] = m22;
    out[11] = m23;
    out[12] = m30;
    out[13] = m31;
    out[14] = m32;
    out[15] = m33;
    return out;
  }
  /**
   * Set a mat4 to the identity matrix
   *
   * @param {mat4} out the receiving matrix
   * @returns {mat4} out
   */

  function identity(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  /**
   * Transpose the values of a mat4
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the source matrix
   * @returns {mat4} out
   */

  function transpose(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
      var a01 = a[1],
          a02 = a[2],
          a03 = a[3];
      var a12 = a[6],
          a13 = a[7];
      var a23 = a[11];
      out[1] = a[4];
      out[2] = a[8];
      out[3] = a[12];
      out[4] = a01;
      out[6] = a[9];
      out[7] = a[13];
      out[8] = a02;
      out[9] = a12;
      out[11] = a[14];
      out[12] = a03;
      out[13] = a13;
      out[14] = a23;
    } else {
      out[0] = a[0];
      out[1] = a[4];
      out[2] = a[8];
      out[3] = a[12];
      out[4] = a[1];
      out[5] = a[5];
      out[6] = a[9];
      out[7] = a[13];
      out[8] = a[2];
      out[9] = a[6];
      out[10] = a[10];
      out[11] = a[14];
      out[12] = a[3];
      out[13] = a[7];
      out[14] = a[11];
      out[15] = a[15];
    }

    return out;
  }
  /**
   * Inverts a mat4
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the source matrix
   * @returns {mat4} out
   */

  function invert$1(out, a) {
    var a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3];
    var a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];
    var a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];
    var a30 = a[12],
        a31 = a[13],
        a32 = a[14],
        a33 = a[15];
    var b00 = a00 * a11 - a01 * a10;
    var b01 = a00 * a12 - a02 * a10;
    var b02 = a00 * a13 - a03 * a10;
    var b03 = a01 * a12 - a02 * a11;
    var b04 = a01 * a13 - a03 * a11;
    var b05 = a02 * a13 - a03 * a12;
    var b06 = a20 * a31 - a21 * a30;
    var b07 = a20 * a32 - a22 * a30;
    var b08 = a20 * a33 - a23 * a30;
    var b09 = a21 * a32 - a22 * a31;
    var b10 = a21 * a33 - a23 * a31;
    var b11 = a22 * a33 - a23 * a32; // Calculate the determinant

    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) {
      return null;
    }

    det = 1.0 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }
  /**
   * Calculates the adjugate of a mat4
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the source matrix
   * @returns {mat4} out
   */

  function adjoint(out, a) {
    var a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3];
    var a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];
    var a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];
    var a30 = a[12],
        a31 = a[13],
        a32 = a[14],
        a33 = a[15];
    out[0] = a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22);
    out[1] = -(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22));
    out[2] = a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12);
    out[3] = -(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12));
    out[4] = -(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22));
    out[5] = a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22);
    out[6] = -(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12));
    out[7] = a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12);
    out[8] = a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21);
    out[9] = -(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21));
    out[10] = a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11);
    out[11] = -(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11));
    out[12] = -(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21));
    out[13] = a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21);
    out[14] = -(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11));
    out[15] = a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11);
    return out;
  }
  /**
   * Calculates the determinant of a mat4
   *
   * @param {ReadonlyMat4} a the source matrix
   * @returns {Number} determinant of a
   */

  function determinant(a) {
    var a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3];
    var a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];
    var a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];
    var a30 = a[12],
        a31 = a[13],
        a32 = a[14],
        a33 = a[15];
    var b00 = a00 * a11 - a01 * a10;
    var b01 = a00 * a12 - a02 * a10;
    var b02 = a00 * a13 - a03 * a10;
    var b03 = a01 * a12 - a02 * a11;
    var b04 = a01 * a13 - a03 * a11;
    var b05 = a02 * a13 - a03 * a12;
    var b06 = a20 * a31 - a21 * a30;
    var b07 = a20 * a32 - a22 * a30;
    var b08 = a20 * a33 - a23 * a30;
    var b09 = a21 * a32 - a22 * a31;
    var b10 = a21 * a33 - a23 * a31;
    var b11 = a22 * a33 - a23 * a32; // Calculate the determinant

    return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  }
  /**
   * Multiplies two mat4s
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the first operand
   * @param {ReadonlyMat4} b the second operand
   * @returns {mat4} out
   */

  function multiply$4(out, a, b) {
    var a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3];
    var a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];
    var a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];
    var a30 = a[12],
        a31 = a[13],
        a32 = a[14],
        a33 = a[15]; // Cache only the current line of the second matrix

    var b0 = b[0],
        b1 = b[1],
        b2 = b[2],
        b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[4];
    b1 = b[5];
    b2 = b[6];
    b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[8];
    b1 = b[9];
    b2 = b[10];
    b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[12];
    b1 = b[13];
    b2 = b[14];
    b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
  }
  /**
   * Translate a mat4 by the given vector
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the matrix to translate
   * @param {ReadonlyVec3} v vector to translate by
   * @returns {mat4} out
   */

  function translate(out, a, v) {
    var x = v[0],
        y = v[1],
        z = v[2];
    var a00, a01, a02, a03;
    var a10, a11, a12, a13;
    var a20, a21, a22, a23;

    if (a === out) {
      out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
      out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
      out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
      out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    } else {
      a00 = a[0];
      a01 = a[1];
      a02 = a[2];
      a03 = a[3];
      a10 = a[4];
      a11 = a[5];
      a12 = a[6];
      a13 = a[7];
      a20 = a[8];
      a21 = a[9];
      a22 = a[10];
      a23 = a[11];
      out[0] = a00;
      out[1] = a01;
      out[2] = a02;
      out[3] = a03;
      out[4] = a10;
      out[5] = a11;
      out[6] = a12;
      out[7] = a13;
      out[8] = a20;
      out[9] = a21;
      out[10] = a22;
      out[11] = a23;
      out[12] = a00 * x + a10 * y + a20 * z + a[12];
      out[13] = a01 * x + a11 * y + a21 * z + a[13];
      out[14] = a02 * x + a12 * y + a22 * z + a[14];
      out[15] = a03 * x + a13 * y + a23 * z + a[15];
    }

    return out;
  }
  /**
   * Scales the mat4 by the dimensions in the given vec3 not using vectorization
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the matrix to scale
   * @param {ReadonlyVec3} v the vec3 to scale the matrix by
   * @returns {mat4} out
   **/

  function scale$3(out, a, v) {
    var x = v[0],
        y = v[1],
        z = v[2];
    out[0] = a[0] * x;
    out[1] = a[1] * x;
    out[2] = a[2] * x;
    out[3] = a[3] * x;
    out[4] = a[4] * y;
    out[5] = a[5] * y;
    out[6] = a[6] * y;
    out[7] = a[7] * y;
    out[8] = a[8] * z;
    out[9] = a[9] * z;
    out[10] = a[10] * z;
    out[11] = a[11] * z;
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
  }
  /**
   * Rotates a mat4 by the given angle around the given axis
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the matrix to rotate
   * @param {Number} rad the angle to rotate the matrix by
   * @param {ReadonlyVec3} axis the axis to rotate around
   * @returns {mat4} out
   */

  function rotate(out, a, rad, axis) {
    var x = axis[0],
        y = axis[1],
        z = axis[2];
    var len = Math.hypot(x, y, z);
    var s, c, t;
    var a00, a01, a02, a03;
    var a10, a11, a12, a13;
    var a20, a21, a22, a23;
    var b00, b01, b02;
    var b10, b11, b12;
    var b20, b21, b22;

    if (len < EPSILON) {
      return null;
    }

    len = 1 / len;
    x *= len;
    y *= len;
    z *= len;
    s = Math.sin(rad);
    c = Math.cos(rad);
    t = 1 - c;
    a00 = a[0];
    a01 = a[1];
    a02 = a[2];
    a03 = a[3];
    a10 = a[4];
    a11 = a[5];
    a12 = a[6];
    a13 = a[7];
    a20 = a[8];
    a21 = a[9];
    a22 = a[10];
    a23 = a[11]; // Construct the elements of the rotation matrix

    b00 = x * x * t + c;
    b01 = y * x * t + z * s;
    b02 = z * x * t - y * s;
    b10 = x * y * t - z * s;
    b11 = y * y * t + c;
    b12 = z * y * t + x * s;
    b20 = x * z * t + y * s;
    b21 = y * z * t - x * s;
    b22 = z * z * t + c; // Perform rotation-specific matrix multiplication

    out[0] = a00 * b00 + a10 * b01 + a20 * b02;
    out[1] = a01 * b00 + a11 * b01 + a21 * b02;
    out[2] = a02 * b00 + a12 * b01 + a22 * b02;
    out[3] = a03 * b00 + a13 * b01 + a23 * b02;
    out[4] = a00 * b10 + a10 * b11 + a20 * b12;
    out[5] = a01 * b10 + a11 * b11 + a21 * b12;
    out[6] = a02 * b10 + a12 * b11 + a22 * b12;
    out[7] = a03 * b10 + a13 * b11 + a23 * b12;
    out[8] = a00 * b20 + a10 * b21 + a20 * b22;
    out[9] = a01 * b20 + a11 * b21 + a21 * b22;
    out[10] = a02 * b20 + a12 * b21 + a22 * b22;
    out[11] = a03 * b20 + a13 * b21 + a23 * b22;

    if (a !== out) {
      // If the source and destination differ, copy the unchanged last row
      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
    }

    return out;
  }
  /**
   * Rotates a matrix by the given angle around the X axis
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the matrix to rotate
   * @param {Number} rad the angle to rotate the matrix by
   * @returns {mat4} out
   */

  function rotateX(out, a, rad) {
    var s = Math.sin(rad);
    var c = Math.cos(rad);
    var a10 = a[4];
    var a11 = a[5];
    var a12 = a[6];
    var a13 = a[7];
    var a20 = a[8];
    var a21 = a[9];
    var a22 = a[10];
    var a23 = a[11];

    if (a !== out) {
      // If the source and destination differ, copy the unchanged rows
      out[0] = a[0];
      out[1] = a[1];
      out[2] = a[2];
      out[3] = a[3];
      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
    } // Perform axis-specific matrix multiplication


    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    return out;
  }
  /**
   * Rotates a matrix by the given angle around the Y axis
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the matrix to rotate
   * @param {Number} rad the angle to rotate the matrix by
   * @returns {mat4} out
   */

  function rotateY(out, a, rad) {
    var s = Math.sin(rad);
    var c = Math.cos(rad);
    var a00 = a[0];
    var a01 = a[1];
    var a02 = a[2];
    var a03 = a[3];
    var a20 = a[8];
    var a21 = a[9];
    var a22 = a[10];
    var a23 = a[11];

    if (a !== out) {
      // If the source and destination differ, copy the unchanged rows
      out[4] = a[4];
      out[5] = a[5];
      out[6] = a[6];
      out[7] = a[7];
      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
    } // Perform axis-specific matrix multiplication


    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    return out;
  }
  /**
   * Rotates a matrix by the given angle around the Z axis
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the matrix to rotate
   * @param {Number} rad the angle to rotate the matrix by
   * @returns {mat4} out
   */

  function rotateZ(out, a, rad) {
    var s = Math.sin(rad);
    var c = Math.cos(rad);
    var a00 = a[0];
    var a01 = a[1];
    var a02 = a[2];
    var a03 = a[3];
    var a10 = a[4];
    var a11 = a[5];
    var a12 = a[6];
    var a13 = a[7];

    if (a !== out) {
      // If the source and destination differ, copy the unchanged last row
      out[8] = a[8];
      out[9] = a[9];
      out[10] = a[10];
      out[11] = a[11];
      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
    } // Perform axis-specific matrix multiplication


    out[0] = a00 * c + a10 * s;
    out[1] = a01 * c + a11 * s;
    out[2] = a02 * c + a12 * s;
    out[3] = a03 * c + a13 * s;
    out[4] = a10 * c - a00 * s;
    out[5] = a11 * c - a01 * s;
    out[6] = a12 * c - a02 * s;
    out[7] = a13 * c - a03 * s;
    return out;
  }
  /**
   * Creates a matrix from a vector translation
   * This is equivalent to (but much faster than):
   *
   *     mat4.identity(dest);
   *     mat4.translate(dest, dest, vec);
   *
   * @param {mat4} out mat4 receiving operation result
   * @param {ReadonlyVec3} v Translation vector
   * @returns {mat4} out
   */

  function fromTranslation(out, v) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    out[15] = 1;
    return out;
  }
  /**
   * Creates a matrix from a vector scaling
   * This is equivalent to (but much faster than):
   *
   *     mat4.identity(dest);
   *     mat4.scale(dest, dest, vec);
   *
   * @param {mat4} out mat4 receiving operation result
   * @param {ReadonlyVec3} v Scaling vector
   * @returns {mat4} out
   */

  function fromScaling(out, v) {
    out[0] = v[0];
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = v[1];
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = v[2];
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  /**
   * Creates a matrix from a given angle around a given axis
   * This is equivalent to (but much faster than):
   *
   *     mat4.identity(dest);
   *     mat4.rotate(dest, dest, rad, axis);
   *
   * @param {mat4} out mat4 receiving operation result
   * @param {Number} rad the angle to rotate the matrix by
   * @param {ReadonlyVec3} axis the axis to rotate around
   * @returns {mat4} out
   */

  function fromRotation(out, rad, axis) {
    var x = axis[0],
        y = axis[1],
        z = axis[2];
    var len = Math.hypot(x, y, z);
    var s, c, t;

    if (len < EPSILON) {
      return null;
    }

    len = 1 / len;
    x *= len;
    y *= len;
    z *= len;
    s = Math.sin(rad);
    c = Math.cos(rad);
    t = 1 - c; // Perform rotation-specific matrix multiplication

    out[0] = x * x * t + c;
    out[1] = y * x * t + z * s;
    out[2] = z * x * t - y * s;
    out[3] = 0;
    out[4] = x * y * t - z * s;
    out[5] = y * y * t + c;
    out[6] = z * y * t + x * s;
    out[7] = 0;
    out[8] = x * z * t + y * s;
    out[9] = y * z * t - x * s;
    out[10] = z * z * t + c;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  /**
   * Creates a matrix from the given angle around the X axis
   * This is equivalent to (but much faster than):
   *
   *     mat4.identity(dest);
   *     mat4.rotateX(dest, dest, rad);
   *
   * @param {mat4} out mat4 receiving operation result
   * @param {Number} rad the angle to rotate the matrix by
   * @returns {mat4} out
   */

  function fromXRotation(out, rad) {
    var s = Math.sin(rad);
    var c = Math.cos(rad); // Perform axis-specific matrix multiplication

    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = c;
    out[6] = s;
    out[7] = 0;
    out[8] = 0;
    out[9] = -s;
    out[10] = c;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  /**
   * Creates a matrix from the given angle around the Y axis
   * This is equivalent to (but much faster than):
   *
   *     mat4.identity(dest);
   *     mat4.rotateY(dest, dest, rad);
   *
   * @param {mat4} out mat4 receiving operation result
   * @param {Number} rad the angle to rotate the matrix by
   * @returns {mat4} out
   */

  function fromYRotation(out, rad) {
    var s = Math.sin(rad);
    var c = Math.cos(rad); // Perform axis-specific matrix multiplication

    out[0] = c;
    out[1] = 0;
    out[2] = -s;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = s;
    out[9] = 0;
    out[10] = c;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  /**
   * Creates a matrix from the given angle around the Z axis
   * This is equivalent to (but much faster than):
   *
   *     mat4.identity(dest);
   *     mat4.rotateZ(dest, dest, rad);
   *
   * @param {mat4} out mat4 receiving operation result
   * @param {Number} rad the angle to rotate the matrix by
   * @returns {mat4} out
   */

  function fromZRotation(out, rad) {
    var s = Math.sin(rad);
    var c = Math.cos(rad); // Perform axis-specific matrix multiplication

    out[0] = c;
    out[1] = s;
    out[2] = 0;
    out[3] = 0;
    out[4] = -s;
    out[5] = c;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  /**
   * Creates a matrix from a quaternion rotation and vector translation
   * This is equivalent to (but much faster than):
   *
   *     mat4.identity(dest);
   *     mat4.translate(dest, vec);
   *     let quatMat = mat4.create();
   *     quat4.toMat4(quat, quatMat);
   *     mat4.multiply(dest, quatMat);
   *
   * @param {mat4} out mat4 receiving operation result
   * @param {quat4} q Rotation quaternion
   * @param {ReadonlyVec3} v Translation vector
   * @returns {mat4} out
   */

  function fromRotationTranslation(out, q, v) {
    // Quaternion math
    var x = q[0],
        y = q[1],
        z = q[2],
        w = q[3];
    var x2 = x + x;
    var y2 = y + y;
    var z2 = z + z;
    var xx = x * x2;
    var xy = x * y2;
    var xz = x * z2;
    var yy = y * y2;
    var yz = y * z2;
    var zz = z * z2;
    var wx = w * x2;
    var wy = w * y2;
    var wz = w * z2;
    out[0] = 1 - (yy + zz);
    out[1] = xy + wz;
    out[2] = xz - wy;
    out[3] = 0;
    out[4] = xy - wz;
    out[5] = 1 - (xx + zz);
    out[6] = yz + wx;
    out[7] = 0;
    out[8] = xz + wy;
    out[9] = yz - wx;
    out[10] = 1 - (xx + yy);
    out[11] = 0;
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    out[15] = 1;
    return out;
  }
  /**
   * Returns the translation vector component of a transformation
   *  matrix. If a matrix is built with fromRotationTranslation,
   *  the returned vector will be the same as the translation vector
   *  originally supplied.
   * @param  {vec3} out Vector to receive translation component
   * @param  {ReadonlyMat4} mat Matrix to be decomposed (input)
   * @return {vec3} out
   */

  function getTranslation(out, mat) {
    out[0] = mat[12];
    out[1] = mat[13];
    out[2] = mat[14];
    return out;
  }
  /**
   * Returns the scaling factor component of a transformation
   *  matrix. If a matrix is built with fromRotationTranslationScale
   *  with a normalized Quaternion paramter, the returned vector will be
   *  the same as the scaling vector
   *  originally supplied.
   * @param  {vec3} out Vector to receive scaling factor component
   * @param  {ReadonlyMat4} mat Matrix to be decomposed (input)
   * @return {vec3} out
   */

  function getScaling(out, mat) {
    var m11 = mat[0];
    var m12 = mat[1];
    var m13 = mat[2];
    var m21 = mat[4];
    var m22 = mat[5];
    var m23 = mat[6];
    var m31 = mat[8];
    var m32 = mat[9];
    var m33 = mat[10];
    out[0] = Math.hypot(m11, m12, m13);
    out[1] = Math.hypot(m21, m22, m23);
    out[2] = Math.hypot(m31, m32, m33);
    return out;
  }
  /**
   * Returns a quaternion representing the rotational component
   *  of a transformation matrix. If a matrix is built with
   *  fromRotationTranslation, the returned quaternion will be the
   *  same as the quaternion originally supplied.
   * @param {quat} out Quaternion to receive the rotation component
   * @param {ReadonlyMat4} mat Matrix to be decomposed (input)
   * @return {quat} out
   */

  function getRotation(out, mat) {
    var scaling = new ARRAY_TYPE(3);
    getScaling(scaling, mat);
    var is1 = 1 / scaling[0];
    var is2 = 1 / scaling[1];
    var is3 = 1 / scaling[2];
    var sm11 = mat[0] * is1;
    var sm12 = mat[1] * is2;
    var sm13 = mat[2] * is3;
    var sm21 = mat[4] * is1;
    var sm22 = mat[5] * is2;
    var sm23 = mat[6] * is3;
    var sm31 = mat[8] * is1;
    var sm32 = mat[9] * is2;
    var sm33 = mat[10] * is3;
    var trace = sm11 + sm22 + sm33;
    var S = 0;

    if (trace > 0) {
      S = Math.sqrt(trace + 1.0) * 2;
      out[3] = 0.25 * S;
      out[0] = (sm23 - sm32) / S;
      out[1] = (sm31 - sm13) / S;
      out[2] = (sm12 - sm21) / S;
    } else if (sm11 > sm22 && sm11 > sm33) {
      S = Math.sqrt(1.0 + sm11 - sm22 - sm33) * 2;
      out[3] = (sm23 - sm32) / S;
      out[0] = 0.25 * S;
      out[1] = (sm12 + sm21) / S;
      out[2] = (sm31 + sm13) / S;
    } else if (sm22 > sm33) {
      S = Math.sqrt(1.0 + sm22 - sm11 - sm33) * 2;
      out[3] = (sm31 - sm13) / S;
      out[0] = (sm12 + sm21) / S;
      out[1] = 0.25 * S;
      out[2] = (sm23 + sm32) / S;
    } else {
      S = Math.sqrt(1.0 + sm33 - sm11 - sm22) * 2;
      out[3] = (sm12 - sm21) / S;
      out[0] = (sm31 + sm13) / S;
      out[1] = (sm23 + sm32) / S;
      out[2] = 0.25 * S;
    }

    return out;
  }
  /**
   * Creates a matrix from a quaternion rotation, vector translation and vector scale
   * This is equivalent to (but much faster than):
   *
   *     mat4.identity(dest);
   *     mat4.translate(dest, vec);
   *     let quatMat = mat4.create();
   *     quat4.toMat4(quat, quatMat);
   *     mat4.multiply(dest, quatMat);
   *     mat4.scale(dest, scale)
   *
   * @param {mat4} out mat4 receiving operation result
   * @param {quat4} q Rotation quaternion
   * @param {ReadonlyVec3} v Translation vector
   * @param {ReadonlyVec3} s Scaling vector
   * @returns {mat4} out
   */

  function fromRotationTranslationScale(out, q, v, s) {
    // Quaternion math
    var x = q[0],
        y = q[1],
        z = q[2],
        w = q[3];
    var x2 = x + x;
    var y2 = y + y;
    var z2 = z + z;
    var xx = x * x2;
    var xy = x * y2;
    var xz = x * z2;
    var yy = y * y2;
    var yz = y * z2;
    var zz = z * z2;
    var wx = w * x2;
    var wy = w * y2;
    var wz = w * z2;
    var sx = s[0];
    var sy = s[1];
    var sz = s[2];
    out[0] = (1 - (yy + zz)) * sx;
    out[1] = (xy + wz) * sx;
    out[2] = (xz - wy) * sx;
    out[3] = 0;
    out[4] = (xy - wz) * sy;
    out[5] = (1 - (xx + zz)) * sy;
    out[6] = (yz + wx) * sy;
    out[7] = 0;
    out[8] = (xz + wy) * sz;
    out[9] = (yz - wx) * sz;
    out[10] = (1 - (xx + yy)) * sz;
    out[11] = 0;
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    out[15] = 1;
    return out;
  }
  /**
   * Calculates a 4x4 matrix from the given quaternion
   *
   * @param {mat4} out mat4 receiving operation result
   * @param {ReadonlyQuat} q Quaternion to create matrix from
   *
   * @returns {mat4} out
   */

  function fromQuat(out, q) {
    var x = q[0],
        y = q[1],
        z = q[2],
        w = q[3];
    var x2 = x + x;
    var y2 = y + y;
    var z2 = z + z;
    var xx = x * x2;
    var yx = y * x2;
    var yy = y * y2;
    var zx = z * x2;
    var zy = z * y2;
    var zz = z * z2;
    var wx = w * x2;
    var wy = w * y2;
    var wz = w * z2;
    out[0] = 1 - yy - zz;
    out[1] = yx + wz;
    out[2] = zx - wy;
    out[3] = 0;
    out[4] = yx - wz;
    out[5] = 1 - xx - zz;
    out[6] = zy + wx;
    out[7] = 0;
    out[8] = zx + wy;
    out[9] = zy - wx;
    out[10] = 1 - xx - yy;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  /**
   * Generates a frustum matrix with the given bounds
   *
   * @param {mat4} out mat4 frustum matrix will be written into
   * @param {Number} left Left bound of the frustum
   * @param {Number} right Right bound of the frustum
   * @param {Number} bottom Bottom bound of the frustum
   * @param {Number} top Top bound of the frustum
   * @param {Number} near Near bound of the frustum
   * @param {Number} far Far bound of the frustum
   * @returns {mat4} out
   */

  function frustum(out, left, right, bottom, top, near, far) {
    var rl = 1 / (right - left);
    var tb = 1 / (top - bottom);
    var nf = 1 / (near - far);
    out[0] = near * 2 * rl;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = near * 2 * tb;
    out[6] = 0;
    out[7] = 0;
    out[8] = (right + left) * rl;
    out[9] = (top + bottom) * tb;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = far * near * 2 * nf;
    out[15] = 0;
    return out;
  }
  /**
   * Generates a perspective projection matrix with the given bounds.
   * The near/far clip planes correspond to a normalized device coordinate Z range of [-1, 1],
   * which matches WebGL/OpenGL's clip volume.
   * Passing null/undefined/no value for far will generate infinite projection matrix.
   *
   * @param {mat4} out mat4 frustum matrix will be written into
   * @param {number} fovy Vertical field of view in radians
   * @param {number} aspect Aspect ratio. typically viewport width/height
   * @param {number} near Near bound of the frustum
   * @param {number} far Far bound of the frustum, can be null or Infinity
   * @returns {mat4} out
   */

  function perspectiveNO(out, fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(fovy / 2),
        nf;
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[15] = 0;

    if (far != null && far !== Infinity) {
      nf = 1 / (near - far);
      out[10] = (far + near) * nf;
      out[14] = 2 * far * near * nf;
    } else {
      out[10] = -1;
      out[14] = -2 * near;
    }

    return out;
  }
  /**
   * Alias for {@link mat4.perspectiveNO}
   * @function
   */

  var perspective = perspectiveNO;
  /**
   * Generates a orthogonal projection matrix with the given bounds.
   * The near/far clip planes correspond to a normalized device coordinate Z range of [-1, 1],
   * which matches WebGL/OpenGL's clip volume.
   *
   * @param {mat4} out mat4 frustum matrix will be written into
   * @param {number} left Left bound of the frustum
   * @param {number} right Right bound of the frustum
   * @param {number} bottom Bottom bound of the frustum
   * @param {number} top Top bound of the frustum
   * @param {number} near Near bound of the frustum
   * @param {number} far Far bound of the frustum
   * @returns {mat4} out
   */

  function orthoNO(out, left, right, bottom, top, near, far) {
    var lr = 1 / (left - right);
    var bt = 1 / (bottom - top);
    var nf = 1 / (near - far);
    out[0] = -2 * lr;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = -2 * bt;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 2 * nf;
    out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
  }
  /**
   * Alias for {@link mat4.orthoNO}
   * @function
   */

  var ortho = orthoNO;
  /**
   * Generates a look-at matrix with the given eye position, focal point, and up axis.
   * If you want a matrix that actually makes an object look at another object, you should use targetTo instead.
   *
   * @param {mat4} out mat4 frustum matrix will be written into
   * @param {ReadonlyVec3} eye Position of the viewer
   * @param {ReadonlyVec3} center Point the viewer is looking at
   * @param {ReadonlyVec3} up vec3 pointing up
   * @returns {mat4} out
   */

  function lookAt(out, eye, center, up) {
    var x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
    var eyex = eye[0];
    var eyey = eye[1];
    var eyez = eye[2];
    var upx = up[0];
    var upy = up[1];
    var upz = up[2];
    var centerx = center[0];
    var centery = center[1];
    var centerz = center[2];

    if (Math.abs(eyex - centerx) < EPSILON && Math.abs(eyey - centery) < EPSILON && Math.abs(eyez - centerz) < EPSILON) {
      return identity(out);
    }

    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;
    len = 1 / Math.hypot(z0, z1, z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;
    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.hypot(x0, x1, x2);

    if (!len) {
      x0 = 0;
      x1 = 0;
      x2 = 0;
    } else {
      len = 1 / len;
      x0 *= len;
      x1 *= len;
      x2 *= len;
    }

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;
    len = Math.hypot(y0, y1, y2);

    if (!len) {
      y0 = 0;
      y1 = 0;
      y2 = 0;
    } else {
      len = 1 / len;
      y0 *= len;
      y1 *= len;
      y2 *= len;
    }

    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;
    return out;
  }
  /**
   * Adds two mat4's
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the first operand
   * @param {ReadonlyMat4} b the second operand
   * @returns {mat4} out
   */

  function add$3(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    out[3] = a[3] + b[3];
    out[4] = a[4] + b[4];
    out[5] = a[5] + b[5];
    out[6] = a[6] + b[6];
    out[7] = a[7] + b[7];
    out[8] = a[8] + b[8];
    out[9] = a[9] + b[9];
    out[10] = a[10] + b[10];
    out[11] = a[11] + b[11];
    out[12] = a[12] + b[12];
    out[13] = a[13] + b[13];
    out[14] = a[14] + b[14];
    out[15] = a[15] + b[15];
    return out;
  }
  /**
   * Subtracts matrix b from matrix a
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the first operand
   * @param {ReadonlyMat4} b the second operand
   * @returns {mat4} out
   */

  function subtract$3(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    out[3] = a[3] - b[3];
    out[4] = a[4] - b[4];
    out[5] = a[5] - b[5];
    out[6] = a[6] - b[6];
    out[7] = a[7] - b[7];
    out[8] = a[8] - b[8];
    out[9] = a[9] - b[9];
    out[10] = a[10] - b[10];
    out[11] = a[11] - b[11];
    out[12] = a[12] - b[12];
    out[13] = a[13] - b[13];
    out[14] = a[14] - b[14];
    out[15] = a[15] - b[15];
    return out;
  }
  /**
   * Multiply each element of the matrix by a scalar.
   *
   * @param {mat4} out the receiving matrix
   * @param {ReadonlyMat4} a the matrix to scale
   * @param {Number} b amount to scale the matrix's elements by
   * @returns {mat4} out
   */

  function multiplyScalar(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    out[2] = a[2] * b;
    out[3] = a[3] * b;
    out[4] = a[4] * b;
    out[5] = a[5] * b;
    out[6] = a[6] * b;
    out[7] = a[7] * b;
    out[8] = a[8] * b;
    out[9] = a[9] * b;
    out[10] = a[10] * b;
    out[11] = a[11] * b;
    out[12] = a[12] * b;
    out[13] = a[13] * b;
    out[14] = a[14] * b;
    out[15] = a[15] * b;
    return out;
  }
  /**
   * Returns whether or not the matrices have approximately the same elements in the same position.
   *
   * @param {ReadonlyMat4} a The first matrix.
   * @param {ReadonlyMat4} b The second matrix.
   * @returns {Boolean} True if the matrices are equal, false otherwise.
   */

  function equals$4(a, b) {
    var a0 = a[0],
        a1 = a[1],
        a2 = a[2],
        a3 = a[3];
    var a4 = a[4],
        a5 = a[5],
        a6 = a[6],
        a7 = a[7];
    var a8 = a[8],
        a9 = a[9],
        a10 = a[10],
        a11 = a[11];
    var a12 = a[12],
        a13 = a[13],
        a14 = a[14],
        a15 = a[15];
    var b0 = b[0],
        b1 = b[1],
        b2 = b[2],
        b3 = b[3];
    var b4 = b[4],
        b5 = b[5],
        b6 = b[6],
        b7 = b[7];
    var b8 = b[8],
        b9 = b[9],
        b10 = b[10],
        b11 = b[11];
    var b12 = b[12],
        b13 = b[13],
        b14 = b[14],
        b15 = b[15];
    return Math.abs(a0 - b0) <= EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON * Math.max(1.0, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON * Math.max(1.0, Math.abs(a3), Math.abs(b3)) && Math.abs(a4 - b4) <= EPSILON * Math.max(1.0, Math.abs(a4), Math.abs(b4)) && Math.abs(a5 - b5) <= EPSILON * Math.max(1.0, Math.abs(a5), Math.abs(b5)) && Math.abs(a6 - b6) <= EPSILON * Math.max(1.0, Math.abs(a6), Math.abs(b6)) && Math.abs(a7 - b7) <= EPSILON * Math.max(1.0, Math.abs(a7), Math.abs(b7)) && Math.abs(a8 - b8) <= EPSILON * Math.max(1.0, Math.abs(a8), Math.abs(b8)) && Math.abs(a9 - b9) <= EPSILON * Math.max(1.0, Math.abs(a9), Math.abs(b9)) && Math.abs(a10 - b10) <= EPSILON * Math.max(1.0, Math.abs(a10), Math.abs(b10)) && Math.abs(a11 - b11) <= EPSILON * Math.max(1.0, Math.abs(a11), Math.abs(b11)) && Math.abs(a12 - b12) <= EPSILON * Math.max(1.0, Math.abs(a12), Math.abs(b12)) && Math.abs(a13 - b13) <= EPSILON * Math.max(1.0, Math.abs(a13), Math.abs(b13)) && Math.abs(a14 - b14) <= EPSILON * Math.max(1.0, Math.abs(a14), Math.abs(b14)) && Math.abs(a15 - b15) <= EPSILON * Math.max(1.0, Math.abs(a15), Math.abs(b15));
  }

  /**
   * 3 Dimensional Vector
   * @module vec3
   */

  /**
   * Creates a new, empty vec3
   *
   * @returns {vec3} a new 3D vector
   */

  function create$3() {
    var out = new ARRAY_TYPE(3);

    if (ARRAY_TYPE != Float32Array) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
    }

    return out;
  }
  /**
   * Calculates the length of a vec3
   *
   * @param {ReadonlyVec3} a vector to calculate length of
   * @returns {Number} length of a
   */

  function length$3(a) {
    var x = a[0];
    var y = a[1];
    var z = a[2];
    return Math.hypot(x, y, z);
  }
  /**
   * Creates a new vec3 initialized with the given values
   *
   * @param {Number} x X component
   * @param {Number} y Y component
   * @param {Number} z Z component
   * @returns {vec3} a new 3D vector
   */

  function fromValues(x, y, z) {
    var out = new ARRAY_TYPE(3);
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
  }
  /**
   * Set the components of a vec3 to the given values
   *
   * @param {vec3} out the receiving vector
   * @param {Number} x X component
   * @param {Number} y Y component
   * @param {Number} z Z component
   * @returns {vec3} out
   */

  function set$2(out, x, y, z) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
  }
  /**
   * Adds two vec3's
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a the first operand
   * @param {ReadonlyVec3} b the second operand
   * @returns {vec3} out
   */

  function add$2(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
  }
  /**
   * Subtracts vector b from vector a
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a the first operand
   * @param {ReadonlyVec3} b the second operand
   * @returns {vec3} out
   */

  function subtract$2(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
  }
  /**
   * Multiplies two vec3's
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a the first operand
   * @param {ReadonlyVec3} b the second operand
   * @returns {vec3} out
   */

  function multiply$3(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    out[2] = a[2] * b[2];
    return out;
  }
  /**
   * Divides two vec3's
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a the first operand
   * @param {ReadonlyVec3} b the second operand
   * @returns {vec3} out
   */

  function divide$2(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    out[2] = a[2] / b[2];
    return out;
  }
  /**
   * Scales a vec3 by a scalar number
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a the vector to scale
   * @param {Number} b amount to scale the vector by
   * @returns {vec3} out
   */

  function scale$2(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    out[2] = a[2] * b;
    return out;
  }
  /**
   * Adds two vec3's after scaling the second operand by a scalar value
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a the first operand
   * @param {ReadonlyVec3} b the second operand
   * @param {Number} scale the amount to scale b by before adding
   * @returns {vec3} out
   */

  function scaleAndAdd$1(out, a, b, scale) {
    out[0] = a[0] + b[0] * scale;
    out[1] = a[1] + b[1] * scale;
    out[2] = a[2] + b[2] * scale;
    return out;
  }
  /**
   * Calculates the euclidian distance between two vec3's
   *
   * @param {ReadonlyVec3} a the first operand
   * @param {ReadonlyVec3} b the second operand
   * @returns {Number} distance between a and b
   */

  function distance$2(a, b) {
    var x = b[0] - a[0];
    var y = b[1] - a[1];
    var z = b[2] - a[2];
    return Math.hypot(x, y, z);
  }
  /**
   * Calculates the squared euclidian distance between two vec3's
   *
   * @param {ReadonlyVec3} a the first operand
   * @param {ReadonlyVec3} b the second operand
   * @returns {Number} squared distance between a and b
   */

  function squaredDistance$2(a, b) {
    var x = b[0] - a[0];
    var y = b[1] - a[1];
    var z = b[2] - a[2];
    return x * x + y * y + z * z;
  }
  /**
   * Negates the components of a vec3
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a vector to negate
   * @returns {vec3} out
   */

  function negate$2(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    return out;
  }
  /**
   * Returns the inverse of the components of a vec3
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a vector to invert
   * @returns {vec3} out
   */

  function inverse$2(out, a) {
    out[0] = 1.0 / a[0];
    out[1] = 1.0 / a[1];
    out[2] = 1.0 / a[2];
    return out;
  }
  /**
   * Normalize a vec3
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a vector to normalize
   * @returns {vec3} out
   */

  function normalize$4(out, a) {
    var x = a[0];
    var y = a[1];
    var z = a[2];
    var len = x * x + y * y + z * z;

    if (len > 0) {
      //TODO: evaluate use of glm_invsqrt here?
      len = 1 / Math.sqrt(len);
    }

    out[0] = a[0] * len;
    out[1] = a[1] * len;
    out[2] = a[2] * len;
    return out;
  }
  /**
   * Calculates the dot product of two vec3's
   *
   * @param {ReadonlyVec3} a the first operand
   * @param {ReadonlyVec3} b the second operand
   * @returns {Number} dot product of a and b
   */

  function dot$3(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
  /**
   * Computes the cross product of two vec3's
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a the first operand
   * @param {ReadonlyVec3} b the second operand
   * @returns {vec3} out
   */

  function cross$2(out, a, b) {
    var ax = a[0],
        ay = a[1],
        az = a[2];
    var bx = b[0],
        by = b[1],
        bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
  }
  /**
   * Performs a linear interpolation between two vec3's
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a the first operand
   * @param {ReadonlyVec3} b the second operand
   * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
   * @returns {vec3} out
   */

  function lerp$2(out, a, b, t) {
    var ax = a[0];
    var ay = a[1];
    var az = a[2];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    out[2] = az + t * (b[2] - az);
    return out;
  }
  /**
   * Transforms the vec3 with a mat4.
   * 4th vector component is implicitly '1'
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a the vector to transform
   * @param {ReadonlyMat4} m matrix to transform with
   * @returns {vec3} out
   */

  function transformMat4$2(out, a, m) {
    var x = a[0],
        y = a[1],
        z = a[2];
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    w = w || 1.0;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
  }
  /**
   * Transforms the vec3 with a mat3.
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a the vector to transform
   * @param {ReadonlyMat3} m the 3x3 matrix to transform with
   * @returns {vec3} out
   */

  function transformMat3$1(out, a, m) {
    var x = a[0],
        y = a[1],
        z = a[2];
    out[0] = x * m[0] + y * m[3] + z * m[6];
    out[1] = x * m[1] + y * m[4] + z * m[7];
    out[2] = x * m[2] + y * m[5] + z * m[8];
    return out;
  }
  /**
   * Transforms the vec3 with a quat
   * Can also be used for dual quaternions. (Multiply it with the real part)
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec3} a the vector to transform
   * @param {ReadonlyQuat} q quaternion to transform with
   * @returns {vec3} out
   */

  function transformQuat$1(out, a, q) {
    // benchmarks: https://jsperf.com/quaternion-transform-vec3-implementations-fixed
    var qx = q[0],
        qy = q[1],
        qz = q[2],
        qw = q[3];
    var x = a[0],
        y = a[1],
        z = a[2]; // var qvec = [qx, qy, qz];
    // var uv = vec3.cross([], qvec, a);

    var uvx = qy * z - qz * y,
        uvy = qz * x - qx * z,
        uvz = qx * y - qy * x; // var uuv = vec3.cross([], qvec, uv);

    var uuvx = qy * uvz - qz * uvy,
        uuvy = qz * uvx - qx * uvz,
        uuvz = qx * uvy - qy * uvx; // vec3.scale(uv, uv, 2 * w);

    var w2 = qw * 2;
    uvx *= w2;
    uvy *= w2;
    uvz *= w2; // vec3.scale(uuv, uuv, 2);

    uuvx *= 2;
    uuvy *= 2;
    uuvz *= 2; // return vec3.add(out, a, vec3.add(out, uv, uuv));

    out[0] = x + uvx + uuvx;
    out[1] = y + uvy + uuvy;
    out[2] = z + uvz + uuvz;
    return out;
  }
  /**
   * Get the angle between two 3D vectors
   * @param {ReadonlyVec3} a The first operand
   * @param {ReadonlyVec3} b The second operand
   * @returns {Number} The angle in radians
   */

  function angle$1(a, b) {
    var ax = a[0],
        ay = a[1],
        az = a[2],
        bx = b[0],
        by = b[1],
        bz = b[2],
        mag1 = Math.sqrt(ax * ax + ay * ay + az * az),
        mag2 = Math.sqrt(bx * bx + by * by + bz * bz),
        mag = mag1 * mag2,
        cosine = mag && dot$3(a, b) / mag;
    return Math.acos(Math.min(Math.max(cosine, -1), 1));
  }
  /**
   * Returns whether or not the vectors have approximately the same elements in the same position.
   *
   * @param {ReadonlyVec3} a The first vector.
   * @param {ReadonlyVec3} b The second vector.
   * @returns {Boolean} True if the vectors are equal, false otherwise.
   */

  function equals$3(a, b) {
    var a0 = a[0],
        a1 = a[1],
        a2 = a[2];
    var b0 = b[0],
        b1 = b[1],
        b2 = b[2];
    return Math.abs(a0 - b0) <= EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON * Math.max(1.0, Math.abs(a2), Math.abs(b2));
  }
  /**
   * Alias for {@link vec3.length}
   * @function
   */

  var len = length$3;
  /**
   * Perform some operation over an array of vec3s.
   *
   * @param {Array} a the array of vectors to iterate over
   * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
   * @param {Number} offset Number of elements to skip at the beginning of the array
   * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
   * @param {Function} fn Function to call for each vector in the array
   * @param {Object} [arg] additional argument to pass to fn
   * @returns {Array} a
   * @function
   */

  (function () {
    var vec = create$3();
    return function (a, stride, offset, count, fn, arg) {
      var i, l;

      if (!stride) {
        stride = 3;
      }

      if (!offset) {
        offset = 0;
      }

      if (count) {
        l = Math.min(count * stride + offset, a.length);
      } else {
        l = a.length;
      }

      for (i = offset; i < l; i += stride) {
        vec[0] = a[i];
        vec[1] = a[i + 1];
        vec[2] = a[i + 2];
        fn(vec, vec, arg);
        a[i] = vec[0];
        a[i + 1] = vec[1];
        a[i + 2] = vec[2];
      }

      return a;
    };
  })();

  /**
   * 4 Dimensional Vector
   * @module vec4
   */

  /**
   * Creates a new, empty vec4
   *
   * @returns {vec4} a new 4D vector
   */

  function create$2() {
    var out = new ARRAY_TYPE(4);

    if (ARRAY_TYPE != Float32Array) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
      out[3] = 0;
    }

    return out;
  }
  /**
   * Copy the values from one vec4 to another
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a the source vector
   * @returns {vec4} out
   */

  function copy$1(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
  }
  /**
   * Set the components of a vec4 to the given values
   *
   * @param {vec4} out the receiving vector
   * @param {Number} x X component
   * @param {Number} y Y component
   * @param {Number} z Z component
   * @param {Number} w W component
   * @returns {vec4} out
   */

  function set$1(out, x, y, z, w) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = w;
    return out;
  }
  /**
   * Adds two vec4's
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a the first operand
   * @param {ReadonlyVec4} b the second operand
   * @returns {vec4} out
   */

  function add$1(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    out[3] = a[3] + b[3];
    return out;
  }
  /**
   * Subtracts vector b from vector a
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a the first operand
   * @param {ReadonlyVec4} b the second operand
   * @returns {vec4} out
   */

  function subtract$1(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    out[3] = a[3] - b[3];
    return out;
  }
  /**
   * Multiplies two vec4's
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a the first operand
   * @param {ReadonlyVec4} b the second operand
   * @returns {vec4} out
   */

  function multiply$2(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    out[2] = a[2] * b[2];
    out[3] = a[3] * b[3];
    return out;
  }
  /**
   * Divides two vec4's
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a the first operand
   * @param {ReadonlyVec4} b the second operand
   * @returns {vec4} out
   */

  function divide$1(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    out[2] = a[2] / b[2];
    out[3] = a[3] / b[3];
    return out;
  }
  /**
   * Scales a vec4 by a scalar number
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a the vector to scale
   * @param {Number} b amount to scale the vector by
   * @returns {vec4} out
   */

  function scale$1(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    out[2] = a[2] * b;
    out[3] = a[3] * b;
    return out;
  }
  /**
   * Adds two vec4's after scaling the second operand by a scalar value
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a the first operand
   * @param {ReadonlyVec4} b the second operand
   * @param {Number} scale the amount to scale b by before adding
   * @returns {vec4} out
   */

  function scaleAndAdd(out, a, b, scale) {
    out[0] = a[0] + b[0] * scale;
    out[1] = a[1] + b[1] * scale;
    out[2] = a[2] + b[2] * scale;
    out[3] = a[3] + b[3] * scale;
    return out;
  }
  /**
   * Calculates the euclidian distance between two vec4's
   *
   * @param {ReadonlyVec4} a the first operand
   * @param {ReadonlyVec4} b the second operand
   * @returns {Number} distance between a and b
   */

  function distance$1(a, b) {
    var x = b[0] - a[0];
    var y = b[1] - a[1];
    var z = b[2] - a[2];
    var w = b[3] - a[3];
    return Math.hypot(x, y, z, w);
  }
  /**
   * Calculates the squared euclidian distance between two vec4's
   *
   * @param {ReadonlyVec4} a the first operand
   * @param {ReadonlyVec4} b the second operand
   * @returns {Number} squared distance between a and b
   */

  function squaredDistance$1(a, b) {
    var x = b[0] - a[0];
    var y = b[1] - a[1];
    var z = b[2] - a[2];
    var w = b[3] - a[3];
    return x * x + y * y + z * z + w * w;
  }
  /**
   * Calculates the length of a vec4
   *
   * @param {ReadonlyVec4} a vector to calculate length of
   * @returns {Number} length of a
   */

  function length$2(a) {
    var x = a[0];
    var y = a[1];
    var z = a[2];
    var w = a[3];
    return Math.hypot(x, y, z, w);
  }
  /**
   * Negates the components of a vec4
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a vector to negate
   * @returns {vec4} out
   */

  function negate$1(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    out[3] = -a[3];
    return out;
  }
  /**
   * Returns the inverse of the components of a vec4
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a vector to invert
   * @returns {vec4} out
   */

  function inverse$1(out, a) {
    out[0] = 1.0 / a[0];
    out[1] = 1.0 / a[1];
    out[2] = 1.0 / a[2];
    out[3] = 1.0 / a[3];
    return out;
  }
  /**
   * Normalize a vec4
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a vector to normalize
   * @returns {vec4} out
   */

  function normalize$3(out, a) {
    var x = a[0];
    var y = a[1];
    var z = a[2];
    var w = a[3];
    var len = x * x + y * y + z * z + w * w;

    if (len > 0) {
      len = 1 / Math.sqrt(len);
    }

    out[0] = x * len;
    out[1] = y * len;
    out[2] = z * len;
    out[3] = w * len;
    return out;
  }
  /**
   * Calculates the dot product of two vec4's
   *
   * @param {ReadonlyVec4} a the first operand
   * @param {ReadonlyVec4} b the second operand
   * @returns {Number} dot product of a and b
   */

  function dot$2(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  }
  /**
   * Returns the cross-product of three vectors in a 4-dimensional space
   *
   * @param {ReadonlyVec4} result the receiving vector
   * @param {ReadonlyVec4} U the first vector
   * @param {ReadonlyVec4} V the second vector
   * @param {ReadonlyVec4} W the third vector
   * @returns {vec4} result
   */

  function cross$1(out, u, v, w) {
    var A = v[0] * w[1] - v[1] * w[0],
        B = v[0] * w[2] - v[2] * w[0],
        C = v[0] * w[3] - v[3] * w[0],
        D = v[1] * w[2] - v[2] * w[1],
        E = v[1] * w[3] - v[3] * w[1],
        F = v[2] * w[3] - v[3] * w[2];
    var G = u[0];
    var H = u[1];
    var I = u[2];
    var J = u[3];
    out[0] = H * F - I * E + J * D;
    out[1] = -(G * F) + I * C - J * B;
    out[2] = G * E - H * C + J * A;
    out[3] = -(G * D) + H * B - I * A;
    return out;
  }
  /**
   * Performs a linear interpolation between two vec4's
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a the first operand
   * @param {ReadonlyVec4} b the second operand
   * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
   * @returns {vec4} out
   */

  function lerp$1(out, a, b, t) {
    var ax = a[0];
    var ay = a[1];
    var az = a[2];
    var aw = a[3];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    out[2] = az + t * (b[2] - az);
    out[3] = aw + t * (b[3] - aw);
    return out;
  }
  /**
   * Transforms the vec4 with a mat4.
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a the vector to transform
   * @param {ReadonlyMat4} m matrix to transform with
   * @returns {vec4} out
   */

  function transformMat4$1(out, a, m) {
    var x = a[0],
        y = a[1],
        z = a[2],
        w = a[3];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return out;
  }
  /**
   * Transforms the vec4 with a quat
   *
   * @param {vec4} out the receiving vector
   * @param {ReadonlyVec4} a the vector to transform
   * @param {ReadonlyQuat} q quaternion to transform with
   * @returns {vec4} out
   */

  function transformQuat(out, a, q) {
    var x = a[0],
        y = a[1],
        z = a[2];
    var qx = q[0],
        qy = q[1],
        qz = q[2],
        qw = q[3]; // calculate quat * vec

    var ix = qw * x + qy * z - qz * y;
    var iy = qw * y + qz * x - qx * z;
    var iz = qw * z + qx * y - qy * x;
    var iw = -qx * x - qy * y - qz * z; // calculate result * inverse quat

    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    out[3] = a[3];
    return out;
  }
  /**
   * Returns whether or not the vectors have approximately the same elements in the same position.
   *
   * @param {ReadonlyVec4} a The first vector.
   * @param {ReadonlyVec4} b The second vector.
   * @returns {Boolean} True if the vectors are equal, false otherwise.
   */

  function equals$2(a, b) {
    var a0 = a[0],
        a1 = a[1],
        a2 = a[2],
        a3 = a[3];
    var b0 = b[0],
        b1 = b[1],
        b2 = b[2],
        b3 = b[3];
    return Math.abs(a0 - b0) <= EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON * Math.max(1.0, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON * Math.max(1.0, Math.abs(a3), Math.abs(b3));
  }
  /**
   * Perform some operation over an array of vec4s.
   *
   * @param {Array} a the array of vectors to iterate over
   * @param {Number} stride Number of elements between the start of each vec4. If 0 assumes tightly packed
   * @param {Number} offset Number of elements to skip at the beginning of the array
   * @param {Number} count Number of vec4s to iterate over. If 0 iterates over entire array
   * @param {Function} fn Function to call for each vector in the array
   * @param {Object} [arg] additional argument to pass to fn
   * @returns {Array} a
   * @function
   */

  (function () {
    var vec = create$2();
    return function (a, stride, offset, count, fn, arg) {
      var i, l;

      if (!stride) {
        stride = 4;
      }

      if (!offset) {
        offset = 0;
      }

      if (count) {
        l = Math.min(count * stride + offset, a.length);
      } else {
        l = a.length;
      }

      for (i = offset; i < l; i += stride) {
        vec[0] = a[i];
        vec[1] = a[i + 1];
        vec[2] = a[i + 2];
        vec[3] = a[i + 3];
        fn(vec, vec, arg);
        a[i] = vec[0];
        a[i + 1] = vec[1];
        a[i + 2] = vec[2];
        a[i + 3] = vec[3];
      }

      return a;
    };
  })();

  /**
   * Quaternion
   * @module quat
   */

  /**
   * Creates a new identity quat
   *
   * @returns {quat} a new quaternion
   */

  function create$1() {
    var out = new ARRAY_TYPE(4);

    if (ARRAY_TYPE != Float32Array) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
    }

    out[3] = 1;
    return out;
  }
  /**
   * Sets a quat from the given angle and rotation axis,
   * then returns it.
   *
   * @param {quat} out the receiving quaternion
   * @param {ReadonlyVec3} axis the axis around which to rotate
   * @param {Number} rad the angle in radians
   * @returns {quat} out
   **/

  function setAxisAngle(out, axis, rad) {
    rad = rad * 0.5;
    var s = Math.sin(rad);
    out[0] = s * axis[0];
    out[1] = s * axis[1];
    out[2] = s * axis[2];
    out[3] = Math.cos(rad);
    return out;
  }
  /**
   * Gets the rotation axis and angle for a given
   *  quaternion. If a quaternion is created with
   *  setAxisAngle, this method will return the same
   *  values as providied in the original parameter list
   *  OR functionally equivalent values.
   * Example: The quaternion formed by axis [0, 0, 1] and
   *  angle -90 is the same as the quaternion formed by
   *  [0, 0, 1] and 270. This method favors the latter.
   * @param  {vec3} out_axis  Vector receiving the axis of rotation
   * @param  {ReadonlyQuat} q     Quaternion to be decomposed
   * @return {Number}     Angle, in radians, of the rotation
   */

  function getAxisAngle(out_axis, q) {
    var rad = Math.acos(q[3]) * 2.0;
    var s = Math.sin(rad / 2.0);

    if (s > EPSILON) {
      out_axis[0] = q[0] / s;
      out_axis[1] = q[1] / s;
      out_axis[2] = q[2] / s;
    } else {
      // If s is zero, return any axis (no rotation - axis does not matter)
      out_axis[0] = 1;
      out_axis[1] = 0;
      out_axis[2] = 0;
    }

    return rad;
  }
  /**
   * Gets the angular distance between two unit quaternions
   *
   * @param  {ReadonlyQuat} a     Origin unit quaternion
   * @param  {ReadonlyQuat} b     Destination unit quaternion
   * @return {Number}     Angle, in radians, between the two quaternions
   */

  function getAngle(a, b) {
    var dotproduct = dot$1(a, b);
    return Math.acos(2 * dotproduct * dotproduct - 1);
  }
  /**
   * Multiplies two quat's
   *
   * @param {quat} out the receiving quaternion
   * @param {ReadonlyQuat} a the first operand
   * @param {ReadonlyQuat} b the second operand
   * @returns {quat} out
   */

  function multiply$1(out, a, b) {
    var ax = a[0],
        ay = a[1],
        az = a[2],
        aw = a[3];
    var bx = b[0],
        by = b[1],
        bz = b[2],
        bw = b[3];
    out[0] = ax * bw + aw * bx + ay * bz - az * by;
    out[1] = ay * bw + aw * by + az * bx - ax * bz;
    out[2] = az * bw + aw * bz + ax * by - ay * bx;
    out[3] = aw * bw - ax * bx - ay * by - az * bz;
    return out;
  }
  /**
   * Performs a spherical linear interpolation between two quat
   *
   * @param {quat} out the receiving quaternion
   * @param {ReadonlyQuat} a the first operand
   * @param {ReadonlyQuat} b the second operand
   * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
   * @returns {quat} out
   */

  function slerp(out, a, b, t) {
    // benchmarks:
    //    http://jsperf.com/quaternion-slerp-implementations
    var ax = a[0],
        ay = a[1],
        az = a[2],
        aw = a[3];
    var bx = b[0],
        by = b[1],
        bz = b[2],
        bw = b[3];
    var omega, cosom, sinom, scale0, scale1; // calc cosine

    cosom = ax * bx + ay * by + az * bz + aw * bw; // adjust signs (if necessary)

    if (cosom < 0.0) {
      cosom = -cosom;
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
    } // calculate coefficients


    if (1.0 - cosom > EPSILON) {
      // standard case (slerp)
      omega = Math.acos(cosom);
      sinom = Math.sin(omega);
      scale0 = Math.sin((1.0 - t) * omega) / sinom;
      scale1 = Math.sin(t * omega) / sinom;
    } else {
      // "from" and "to" quaternions are very close
      //  ... so we can do a linear interpolation
      scale0 = 1.0 - t;
      scale1 = t;
    } // calculate final values


    out[0] = scale0 * ax + scale1 * bx;
    out[1] = scale0 * ay + scale1 * by;
    out[2] = scale0 * az + scale1 * bz;
    out[3] = scale0 * aw + scale1 * bw;
    return out;
  }
  /**
   * Calculates the inverse of a quat
   *
   * @param {quat} out the receiving quaternion
   * @param {ReadonlyQuat} a quat to calculate inverse of
   * @returns {quat} out
   */

  function invert(out, a) {
    var a0 = a[0],
        a1 = a[1],
        a2 = a[2],
        a3 = a[3];
    var dot = a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
    var invDot = dot ? 1.0 / dot : 0; // TODO: Would be faster to return [0,0,0,0] immediately if dot == 0

    out[0] = -a0 * invDot;
    out[1] = -a1 * invDot;
    out[2] = -a2 * invDot;
    out[3] = a3 * invDot;
    return out;
  }
  /**
   * Calculates the conjugate of a quat
   * If the quaternion is normalized, this function is faster than quat.inverse and produces the same result.
   *
   * @param {quat} out the receiving quaternion
   * @param {ReadonlyQuat} a quat to calculate conjugate of
   * @returns {quat} out
   */

  function conjugate(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    out[3] = a[3];
    return out;
  }
  /**
   * Creates a quaternion from the given 3x3 rotation matrix.
   *
   * NOTE: The resultant quaternion is not normalized, so you should be sure
   * to renormalize the quaternion yourself where necessary.
   *
   * @param {quat} out the receiving quaternion
   * @param {ReadonlyMat3} m rotation matrix
   * @returns {quat} out
   * @function
   */

  function fromMat3(out, m) {
    // Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
    // article "Quaternion Calculus and Fast Animation".
    var fTrace = m[0] + m[4] + m[8];
    var fRoot;

    if (fTrace > 0.0) {
      // |w| > 1/2, may as well choose w > 1/2
      fRoot = Math.sqrt(fTrace + 1.0); // 2w

      out[3] = 0.5 * fRoot;
      fRoot = 0.5 / fRoot; // 1/(4w)

      out[0] = (m[5] - m[7]) * fRoot;
      out[1] = (m[6] - m[2]) * fRoot;
      out[2] = (m[1] - m[3]) * fRoot;
    } else {
      // |w| <= 1/2
      var i = 0;
      if (m[4] > m[0]) i = 1;
      if (m[8] > m[i * 3 + i]) i = 2;
      var j = (i + 1) % 3;
      var k = (i + 2) % 3;
      fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1.0);
      out[i] = 0.5 * fRoot;
      fRoot = 0.5 / fRoot;
      out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot;
      out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
      out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
    }

    return out;
  }
  /**
   * Creates a quaternion from the given euler angle x, y, z.
   *
   * @param {quat} out the receiving quaternion
   * @param {x} Angle to rotate around X axis in degrees.
   * @param {y} Angle to rotate around Y axis in degrees.
   * @param {z} Angle to rotate around Z axis in degrees.
   * @returns {quat} out
   * @function
   */

  function fromEuler(out, x, y, z) {
    var halfToRad = 0.5 * Math.PI / 180.0;
    x *= halfToRad;
    y *= halfToRad;
    z *= halfToRad;
    var sx = Math.sin(x);
    var cx = Math.cos(x);
    var sy = Math.sin(y);
    var cy = Math.cos(y);
    var sz = Math.sin(z);
    var cz = Math.cos(z);
    out[0] = sx * cy * cz - cx * sy * sz;
    out[1] = cx * sy * cz + sx * cy * sz;
    out[2] = cx * cy * sz - sx * sy * cz;
    out[3] = cx * cy * cz + sx * sy * sz;
    return out;
  }
  /**
   * Copy the values from one quat to another
   *
   * @param {quat} out the receiving quaternion
   * @param {ReadonlyQuat} a the source quaternion
   * @returns {quat} out
   * @function
   */

  var copy = copy$1;
  /**
   * Set the components of a quat to the given values
   *
   * @param {quat} out the receiving quaternion
   * @param {Number} x X component
   * @param {Number} y Y component
   * @param {Number} z Z component
   * @param {Number} w W component
   * @returns {quat} out
   * @function
   */

  var set = set$1;
  /**
   * Calculates the dot product of two quat's
   *
   * @param {ReadonlyQuat} a the first operand
   * @param {ReadonlyQuat} b the second operand
   * @returns {Number} dot product of a and b
   * @function
   */

  var dot$1 = dot$2;
  /**
   * Calculates the length of a quat
   *
   * @param {ReadonlyQuat} a vector to calculate length of
   * @returns {Number} length of a
   */

  var length$1 = length$2;
  /**
   * Normalize a quat
   *
   * @param {quat} out the receiving quaternion
   * @param {ReadonlyQuat} a quaternion to normalize
   * @returns {quat} out
   * @function
   */

  var normalize$2 = normalize$3;
  /**
   * Sets a quaternion to represent the shortest rotation from one
   * vector to another.
   *
   * Both vectors are assumed to be unit length.
   *
   * @param {quat} out the receiving quaternion.
   * @param {ReadonlyVec3} a the initial vector
   * @param {ReadonlyVec3} b the destination vector
   * @returns {quat} out
   */

  (function () {
    var tmpvec3 = create$3();
    var xUnitVec3 = fromValues(1, 0, 0);
    var yUnitVec3 = fromValues(0, 1, 0);
    return function (out, a, b) {
      var dot = dot$3(a, b);

      if (dot < -0.999999) {
        cross$2(tmpvec3, xUnitVec3, a);
        if (len(tmpvec3) < 0.000001) cross$2(tmpvec3, yUnitVec3, a);
        normalize$4(tmpvec3, tmpvec3);
        setAxisAngle(out, tmpvec3, Math.PI);
        return out;
      } else if (dot > 0.999999) {
        out[0] = 0;
        out[1] = 0;
        out[2] = 0;
        out[3] = 1;
        return out;
      } else {
        cross$2(tmpvec3, a, b);
        out[0] = tmpvec3[0];
        out[1] = tmpvec3[1];
        out[2] = tmpvec3[2];
        out[3] = 1 + dot;
        return normalize$2(out, out);
      }
    };
  })();
  /**
   * Performs a spherical linear interpolation with two control points
   *
   * @param {quat} out the receiving quaternion
   * @param {ReadonlyQuat} a the first operand
   * @param {ReadonlyQuat} b the second operand
   * @param {ReadonlyQuat} c the third operand
   * @param {ReadonlyQuat} d the fourth operand
   * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
   * @returns {quat} out
   */

  (function () {
    var temp1 = create$1();
    var temp2 = create$1();
    return function (out, a, b, c, d, t) {
      slerp(temp1, a, d, t);
      slerp(temp2, b, c, t);
      slerp(out, temp1, temp2, 2 * t * (1 - t));
      return out;
    };
  })();
  /**
   * Sets the specified quaternion with values corresponding to the given
   * axes. Each axis is a vec3 and is expected to be unit length and
   * perpendicular to all other specified axes.
   *
   * @param {ReadonlyVec3} view  the vector representing the viewing direction
   * @param {ReadonlyVec3} right the vector representing the local "right" direction
   * @param {ReadonlyVec3} up    the vector representing the local "up" direction
   * @returns {quat} out
   */

  (function () {
    var matr = create$4();
    return function (out, view, right, up) {
      matr[0] = right[0];
      matr[3] = right[1];
      matr[6] = right[2];
      matr[1] = up[0];
      matr[4] = up[1];
      matr[7] = up[2];
      matr[2] = -view[0];
      matr[5] = -view[1];
      matr[8] = -view[2];
      return normalize$2(out, fromMat3(out, matr));
    };
  })();

  /**
   * 2 Dimensional Vector
   * @module vec2
   */

  /**
   * Creates a new, empty vec2
   *
   * @returns {vec2} a new 2D vector
   */

  function create() {
    var out = new ARRAY_TYPE(2);

    if (ARRAY_TYPE != Float32Array) {
      out[0] = 0;
      out[1] = 0;
    }

    return out;
  }
  /**
   * Adds two vec2's
   *
   * @param {vec2} out the receiving vector
   * @param {ReadonlyVec2} a the first operand
   * @param {ReadonlyVec2} b the second operand
   * @returns {vec2} out
   */

  function add(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    return out;
  }
  /**
   * Subtracts vector b from vector a
   *
   * @param {vec2} out the receiving vector
   * @param {ReadonlyVec2} a the first operand
   * @param {ReadonlyVec2} b the second operand
   * @returns {vec2} out
   */

  function subtract(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    return out;
  }
  /**
   * Multiplies two vec2's
   *
   * @param {vec2} out the receiving vector
   * @param {ReadonlyVec2} a the first operand
   * @param {ReadonlyVec2} b the second operand
   * @returns {vec2} out
   */

  function multiply(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    return out;
  }
  /**
   * Divides two vec2's
   *
   * @param {vec2} out the receiving vector
   * @param {ReadonlyVec2} a the first operand
   * @param {ReadonlyVec2} b the second operand
   * @returns {vec2} out
   */

  function divide(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    return out;
  }
  /**
   * Scales a vec2 by a scalar number
   *
   * @param {vec2} out the receiving vector
   * @param {ReadonlyVec2} a the vector to scale
   * @param {Number} b amount to scale the vector by
   * @returns {vec2} out
   */

  function scale(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    return out;
  }
  /**
   * Calculates the euclidian distance between two vec2's
   *
   * @param {ReadonlyVec2} a the first operand
   * @param {ReadonlyVec2} b the second operand
   * @returns {Number} distance between a and b
   */

  function distance(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1];
    return Math.hypot(x, y);
  }
  /**
   * Calculates the squared euclidian distance between two vec2's
   *
   * @param {ReadonlyVec2} a the first operand
   * @param {ReadonlyVec2} b the second operand
   * @returns {Number} squared distance between a and b
   */

  function squaredDistance(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1];
    return x * x + y * y;
  }
  /**
   * Calculates the length of a vec2
   *
   * @param {ReadonlyVec2} a vector to calculate length of
   * @returns {Number} length of a
   */

  function length(a) {
    var x = a[0],
        y = a[1];
    return Math.hypot(x, y);
  }
  /**
   * Negates the components of a vec2
   *
   * @param {vec2} out the receiving vector
   * @param {ReadonlyVec2} a vector to negate
   * @returns {vec2} out
   */

  function negate(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    return out;
  }
  /**
   * Returns the inverse of the components of a vec2
   *
   * @param {vec2} out the receiving vector
   * @param {ReadonlyVec2} a vector to invert
   * @returns {vec2} out
   */

  function inverse(out, a) {
    out[0] = 1.0 / a[0];
    out[1] = 1.0 / a[1];
    return out;
  }
  /**
   * Normalize a vec2
   *
   * @param {vec2} out the receiving vector
   * @param {ReadonlyVec2} a vector to normalize
   * @returns {vec2} out
   */

  function normalize$1(out, a) {
    var x = a[0],
        y = a[1];
    var len = x * x + y * y;

    if (len > 0) {
      //TODO: evaluate use of glm_invsqrt here?
      len = 1 / Math.sqrt(len);
    }

    out[0] = a[0] * len;
    out[1] = a[1] * len;
    return out;
  }
  /**
   * Calculates the dot product of two vec2's
   *
   * @param {ReadonlyVec2} a the first operand
   * @param {ReadonlyVec2} b the second operand
   * @returns {Number} dot product of a and b
   */

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1];
  }
  /**
   * Computes the cross product of two vec2's
   * Note that the cross product must by definition produce a 3D vector
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec2} a the first operand
   * @param {ReadonlyVec2} b the second operand
   * @returns {vec3} out
   */

  function cross(out, a, b) {
    var z = a[0] * b[1] - a[1] * b[0];
    out[0] = out[1] = 0;
    out[2] = z;
    return out;
  }
  /**
   * Performs a linear interpolation between two vec2's
   *
   * @param {vec2} out the receiving vector
   * @param {ReadonlyVec2} a the first operand
   * @param {ReadonlyVec2} b the second operand
   * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
   * @returns {vec2} out
   */

  function lerp(out, a, b, t) {
    var ax = a[0],
        ay = a[1];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    return out;
  }
  /**
   * Transforms the vec2 with a mat3
   * 3rd vector component is implicitly '1'
   *
   * @param {vec2} out the receiving vector
   * @param {ReadonlyVec2} a the vector to transform
   * @param {ReadonlyMat3} m matrix to transform with
   * @returns {vec2} out
   */

  function transformMat3(out, a, m) {
    var x = a[0],
        y = a[1];
    out[0] = m[0] * x + m[3] * y + m[6];
    out[1] = m[1] * x + m[4] * y + m[7];
    return out;
  }
  /**
   * Transforms the vec2 with a mat4
   * 3rd vector component is implicitly '0'
   * 4th vector component is implicitly '1'
   *
   * @param {vec2} out the receiving vector
   * @param {ReadonlyVec2} a the vector to transform
   * @param {ReadonlyMat4} m matrix to transform with
   * @returns {vec2} out
   */

  function transformMat4(out, a, m) {
    var x = a[0];
    var y = a[1];
    out[0] = m[0] * x + m[4] * y + m[12];
    out[1] = m[1] * x + m[5] * y + m[13];
    return out;
  }
  /**
   * Get the angle between two 2D vectors
   * @param {ReadonlyVec2} a The first operand
   * @param {ReadonlyVec2} b The second operand
   * @returns {Number} The angle in radians
   */

  function angle(a, b) {
    var x1 = a[0],
        y1 = a[1],
        x2 = b[0],
        y2 = b[1],
        // mag is the product of the magnitudes of a and b
    mag = Math.sqrt(x1 * x1 + y1 * y1) * Math.sqrt(x2 * x2 + y2 * y2),
        // mag &&.. short circuits if mag == 0
    cosine = mag && (x1 * x2 + y1 * y2) / mag; // Math.min(Math.max(cosine, -1), 1) clamps the cosine between -1 and 1

    return Math.acos(Math.min(Math.max(cosine, -1), 1));
  }
  /**
   * Returns whether or not the vectors have approximately the same elements in the same position.
   *
   * @param {ReadonlyVec2} a The first vector.
   * @param {ReadonlyVec2} b The second vector.
   * @returns {Boolean} True if the vectors are equal, false otherwise.
   */

  function equals$1(a, b) {
    var a0 = a[0],
        a1 = a[1];
    var b0 = b[0],
        b1 = b[1];
    return Math.abs(a0 - b0) <= EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1));
  }
  /**
   * Perform some operation over an array of vec2s.
   *
   * @param {Array} a the array of vectors to iterate over
   * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
   * @param {Number} offset Number of elements to skip at the beginning of the array
   * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
   * @param {Function} fn Function to call for each vector in the array
   * @param {Object} [arg] additional argument to pass to fn
   * @returns {Array} a
   * @function
   */

  (function () {
    var vec = create();
    return function (a, stride, offset, count, fn, arg) {
      var i, l;

      if (!stride) {
        stride = 2;
      }

      if (!offset) {
        offset = 0;
      }

      if (count) {
        l = Math.min(count * stride + offset, a.length);
      } else {
        l = a.length;
      }

      for (i = offset; i < l; i += stride) {
        vec[0] = a[i];
        vec[1] = a[i + 1];
        fn(vec, vec, arg);
        a[i] = vec[0];
        a[i + 1] = vec[1];
      }

      return a;
    };
  })();

  var r={grad:.9,turn:360,rad:360/(2*Math.PI)},t=function(r){return "string"==typeof r?r.length>0:"number"==typeof r},n=function(r,t,n){return void 0===t&&(t=0),void 0===n&&(n=Math.pow(10,t)),Math.round(n*r)/n+0},e=function(r,t,n){return void 0===t&&(t=0),void 0===n&&(n=1),r>n?n:r>t?r:t},u=function(r){return (r=isFinite(r)?r%360:0)>0?r:r+360},a=function(r){return {r:e(r.r,0,255),g:e(r.g,0,255),b:e(r.b,0,255),a:e(r.a)}},o=function(r){return {r:n(r.r),g:n(r.g),b:n(r.b),a:n(r.a,3)}},i=/^#([0-9a-f]{3,8})$/i,s=function(r){var t=r.toString(16);return t.length<2?"0"+t:t},h=function(r){var t=r.r,n=r.g,e=r.b,u=r.a,a=Math.max(t,n,e),o=a-Math.min(t,n,e),i=o?a===t?(n-e)/o:a===n?2+(e-t)/o:4+(t-n)/o:0;return {h:60*(i<0?i+6:i),s:a?o/a*100:0,v:a/255*100,a:u}},b=function(r){var t=r.h,n=r.s,e=r.v,u=r.a;t=t/360*6,n/=100,e/=100;var a=Math.floor(t),o=e*(1-n),i=e*(1-(t-a)*n),s=e*(1-(1-t+a)*n),h=a%6;return {r:255*[e,i,o,o,s,e][h],g:255*[s,e,e,i,o,o][h],b:255*[o,o,s,e,e,i][h],a:u}},g=function(r){return {h:u(r.h),s:e(r.s,0,100),l:e(r.l,0,100),a:e(r.a)}},d=function(r){return {h:n(r.h),s:n(r.s),l:n(r.l),a:n(r.a,3)}},f=function(r){return b((n=(t=r).s,{h:t.h,s:(n*=((e=t.l)<50?e:100-e)/100)>0?2*n/(e+n)*100:0,v:e+n,a:t.a}));var t,n,e;},c=function(r){return {h:(t=h(r)).h,s:(u=(200-(n=t.s))*(e=t.v)/100)>0&&u<200?n*e/100/(u<=100?u:200-u)*100:0,l:u/2,a:t.a};var t,n,e,u;},l=/^hsla?\(\s*([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*,\s*([+-]?\d*\.?\d+)%\s*,\s*([+-]?\d*\.?\d+)%\s*(?:,\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i,p=/^hsla?\(\s*([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s+([+-]?\d*\.?\d+)%\s+([+-]?\d*\.?\d+)%\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i,v=/^rgba?\(\s*([+-]?\d*\.?\d+)(%)?\s*,\s*([+-]?\d*\.?\d+)(%)?\s*,\s*([+-]?\d*\.?\d+)(%)?\s*(?:,\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i,m=/^rgba?\(\s*([+-]?\d*\.?\d+)(%)?\s+([+-]?\d*\.?\d+)(%)?\s+([+-]?\d*\.?\d+)(%)?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i,y={string:[[function(r){var t=i.exec(r);return t?(r=t[1]).length<=4?{r:parseInt(r[0]+r[0],16),g:parseInt(r[1]+r[1],16),b:parseInt(r[2]+r[2],16),a:4===r.length?n(parseInt(r[3]+r[3],16)/255,2):1}:6===r.length||8===r.length?{r:parseInt(r.substr(0,2),16),g:parseInt(r.substr(2,2),16),b:parseInt(r.substr(4,2),16),a:8===r.length?n(parseInt(r.substr(6,2),16)/255,2):1}:null:null},"hex"],[function(r){var t=v.exec(r)||m.exec(r);return t?t[2]!==t[4]||t[4]!==t[6]?null:a({r:Number(t[1])/(t[2]?100/255:1),g:Number(t[3])/(t[4]?100/255:1),b:Number(t[5])/(t[6]?100/255:1),a:void 0===t[7]?1:Number(t[7])/(t[8]?100:1)}):null},"rgb"],[function(t){var n=l.exec(t)||p.exec(t);if(!n)return null;var e,u,a=g({h:(e=n[1],u=n[2],void 0===u&&(u="deg"),Number(e)*(r[u]||1)),s:Number(n[3]),l:Number(n[4]),a:void 0===n[5]?1:Number(n[5])/(n[6]?100:1)});return f(a)},"hsl"]],object:[[function(r){var n=r.r,e=r.g,u=r.b,o=r.a,i=void 0===o?1:o;return t(n)&&t(e)&&t(u)?a({r:Number(n),g:Number(e),b:Number(u),a:Number(i)}):null},"rgb"],[function(r){var n=r.h,e=r.s,u=r.l,a=r.a,o=void 0===a?1:a;if(!t(n)||!t(e)||!t(u))return null;var i=g({h:Number(n),s:Number(e),l:Number(u),a:Number(o)});return f(i)},"hsl"],[function(r){var n=r.h,a=r.s,o=r.v,i=r.a,s=void 0===i?1:i;if(!t(n)||!t(a)||!t(o))return null;var h=function(r){return {h:u(r.h),s:e(r.s,0,100),v:e(r.v,0,100),a:e(r.a)}}({h:Number(n),s:Number(a),v:Number(o),a:Number(s)});return b(h)},"hsv"]]},N=function(r,t){for(var n=0;n<t.length;n++){var e=t[n][0](r);if(e)return [e,t[n][1]]}return [null,void 0]},x=function(r){return "string"==typeof r?N(r.trim(),y.string):"object"==typeof r&&null!==r?N(r,y.object):[null,void 0]},M=function(r,t){var n=c(r);return {h:n.h,s:e(n.s+100*t,0,100),l:n.l,a:n.a}},H=function(r){return (299*r.r+587*r.g+114*r.b)/1e3/255},$=function(r,t){var n=c(r);return {h:n.h,s:n.s,l:e(n.l+100*t,0,100),a:n.a}},j=function(){function r(r){this.parsed=x(r)[0],this.rgba=this.parsed||{r:0,g:0,b:0,a:1};}return r.prototype.isValid=function(){return null!==this.parsed},r.prototype.brightness=function(){return n(H(this.rgba),2)},r.prototype.isDark=function(){return H(this.rgba)<.5},r.prototype.isLight=function(){return H(this.rgba)>=.5},r.prototype.toHex=function(){return r=o(this.rgba),t=r.r,e=r.g,u=r.b,i=(a=r.a)<1?s(n(255*a)):"","#"+s(t)+s(e)+s(u)+i;var r,t,e,u,a,i;},r.prototype.toRgb=function(){return o(this.rgba)},r.prototype.toRgbString=function(){return r=o(this.rgba),t=r.r,n=r.g,e=r.b,(u=r.a)<1?"rgba("+t+", "+n+", "+e+", "+u+")":"rgb("+t+", "+n+", "+e+")";var r,t,n,e,u;},r.prototype.toHsl=function(){return d(c(this.rgba))},r.prototype.toHslString=function(){return r=d(c(this.rgba)),t=r.h,n=r.s,e=r.l,(u=r.a)<1?"hsla("+t+", "+n+"%, "+e+"%, "+u+")":"hsl("+t+", "+n+"%, "+e+"%)";var r,t,n,e,u;},r.prototype.toHsv=function(){return r=h(this.rgba),{h:n(r.h),s:n(r.s),v:n(r.v),a:n(r.a,3)};var r;},r.prototype.invert=function(){return w({r:255-(r=this.rgba).r,g:255-r.g,b:255-r.b,a:r.a});var r;},r.prototype.saturate=function(r){return void 0===r&&(r=.1),w(M(this.rgba,r))},r.prototype.desaturate=function(r){return void 0===r&&(r=.1),w(M(this.rgba,-r))},r.prototype.grayscale=function(){return w(M(this.rgba,-1))},r.prototype.lighten=function(r){return void 0===r&&(r=.1),w($(this.rgba,r))},r.prototype.darken=function(r){return void 0===r&&(r=.1),w($(this.rgba,-r))},r.prototype.rotate=function(r){return void 0===r&&(r=15),this.hue(this.hue()+r)},r.prototype.alpha=function(r){return "number"==typeof r?w({r:(t=this.rgba).r,g:t.g,b:t.b,a:r}):n(this.rgba.a,3);var t;},r.prototype.hue=function(r){var t=c(this.rgba);return "number"==typeof r?w({h:r,s:t.s,l:t.l,a:t.a}):n(t.h)},r.prototype.isEqual=function(r){return this.toHex()===w(r).toHex()},r}(),w=function(r){return r instanceof j?r:new j(r)},S=[],k=function(r){r.forEach(function(r){S.indexOf(r)<0&&(r(j,y),S.push(r));});};

  function parseShader(shader, defines = [], includes = []) {
    return shader.replace(/#defines/, defines.join("\n")).replace(/#includes/, includes.join("\n"));
  }
  function defineShader(shader, defines = {}) {
    return Object.keys(defines).reduce((str, key) => defines[key] ? `#define ${key} ${defines[key]}
${str}` : str, shader);
  }
  function getShaderName(shader, defaultName = "unnamed") {
    const SHADER_NAME_REGEXP = /#define\s*SHADER_NAME\s*([A-Za-z0-9_-]+)\s*/;
    const match = shader.match(SHADER_NAME_REGEXP);
    return match ? match[1] : defaultName;
  }
  function getWireframeIndex(position, indices, numIndices, data) {
    const edges = /* @__PURE__ */ new Set();
    if (data) {
      for (let j = 0, l = numIndices; j < l; j += 3) {
        const a = data[j];
        const b = data[j + 1];
        const c = data[j + 2];
        const array = [a, b, b, c, c, a];
        for (let i = 0; i < array.length; i += 2) {
          if (isUniqueEdge(array[i] * 3, array[i + 1] * 3, position, edges)) {
            indices.push(array[i], array[i + 1]);
          }
        }
      }
    } else {
      for (let j = 0, l = numIndices; j < l; j += 3) {
        const a = j;
        const b = j + 1;
        const c = j + 2;
        const array = [a, b, b, c, c, a];
        for (let i = 0; i < array.length; i += 2) {
          if (isUniqueEdge(array[i] * 3, array[i + 1] * 3, position, edges)) {
            indices.push(array[i], array[i + 1]);
          }
        }
      }
    }
    return indices;
  }
  function isUniqueEdge(start, end, position, edges) {
    const hash1 = `${position[start]},${position[start + 1]},${position[start + 2]}-${position[end]},${position[end + 1]},${position[end + 2]}`;
    const hash2 = `${position[end]},${position[end + 1]},${position[end + 2]}-${position[start]},${position[start + 1]},${position[start + 2]}`;
    if (edges.has(hash1) === true || edges.has(hash2) === true) {
      return false;
    } else {
      edges.add(hash1);
      edges.add(hash2);
      return true;
    }
  }

  const DEG_TO_RAD = Math.PI / 180;
  const RAD_TO_DEG = 180 / Math.PI;
  function degToRad$1(deg) {
    return deg * DEG_TO_RAD;
  }
  function radToDeg$1(a) {
    return a * RAD_TO_DEG;
  }
  function clamp$1(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }
  function isPowerOfTwo(value) {
    return Math.log(value) / Math.LN2 % 1 === 0;
  }
  let FloatArray = Float32Array;
  function highPrecision(b, notifyGlMatrix = true) {
    if (b) {
      FloatArray = Float64Array;
    } else {
      FloatArray = Float32Array;
    }
    if (notifyGlMatrix) {
      setMatrixArrayType(FloatArray);
    }
  }
  function getFloatArrayConstructor() {
    return FloatArray;
  }

  function isWebGL(gl) {
    if (typeof WebGLRenderingContext !== "undefined" && gl instanceof WebGLRenderingContext) {
      return true;
    }
    if (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext) {
      return true;
    }
    if (gl?.gl && (gl.gl instanceof WebGLRenderingContext || gl.gl instanceof WebGL2RenderingContext)) {
      return true;
    }
    return Boolean(gl && Number.isFinite(gl._version));
  }
  function isWebGL2(gl) {
    if (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext) {
      return true;
    }
    if (gl?.gl && gl.gl instanceof WebGL2RenderingContext) {
      return true;
    }
    return Boolean(gl && gl._version === 2);
  }
  function getContext(canvas, glOptions = {}, requestWebGl2 = false) {
    const names = ["webgl2", "webgl", "experimental-webgl"];
    if (!requestWebGl2) {
      names.shift();
    }
    let context = null;
    function onContextCreationError(error) {
      console.error(error.statusMessage);
    }
    canvas?.addEventListener?.("webglcontextcreationerror", onContextCreationError, false);
    for (let ii = 0; ii < names.length; ++ii) {
      try {
        context = canvas.getContext(names[ii], glOptions);
      } catch (e) {
      }
      if (context) {
        break;
      }
    }
    canvas?.removeEventListener?.("webglcontextcreationerror", onContextCreationError, false);
    return context;
  }

  const now = () => ("undefined" == typeof performance ? Date : performance).now();
  function typeOf(value) {
    return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
  }
  function isString(s) {
    return typeOf(s) === "string";
  }
  function isUndef(s) {
    return typeOf(s) === "undefined";
  }
  function isHex(string) {
    return isString(string) && string.includes("%");
  }
  function isNumber(s) {
    return typeOf(s) === "number";
  }
  function isRegexp(obj) {
    return typeOf(obj) === "regexp";
  }
  function isNull(value) {
    return value == null;
  }
  function isObject(value) {
    const type = typeof value;
    return value !== null && (type === "object" || type === "function");
  }
  function hasValue(v, state) {
    if (isObject(v)) {
      return !isNull(v.value) && (isNull(state) || v.value === state);
    } else {
      return !isNull(v) && (isNull(state) || v === state);
    }
  }
  const uidCounters = {};
  function uid(id = "id") {
    uidCounters[id] = uidCounters[id] || 1;
    const count = uidCounters[id]++;
    return `${id}-${count}`;
  }
  function omit(obj, keys = []) {
    return Object.keys(obj).filter((key) => keys.indexOf(key) < 0).reduce(
      (newObj, key) => Object.assign(newObj, {
        [key]: obj[key]
      }),
      {}
    );
  }
  function pick(obj, keys = []) {
    return Object.keys(obj).filter((key) => keys.indexOf(key) > -1).reduce(
      (newObj, key) => Object.assign(newObj, {
        [key]: obj[key]
      }),
      {}
    );
  }
  const callbacks = [];
  const fpsInterval = 1e3 / 60;
  let time = performance.now();
  function requestAnimationFrameLoop() {
    const current = now();
    const delta = current - time;
    if (delta >= fpsInterval) {
      time = current - delta % fpsInterval;
      const funcs = callbacks.slice();
      callbacks.length = 0;
      for (let i = 0; i < funcs.length; i++) {
        funcs[i] && funcs[i](current, delta);
      }
    } else {
      setImmediate(requestAnimationFrameLoop);
    }
  }
  function raf(func) {
    callbacks.push(func);
    if (callbacks.length === 1) {
      setImmediate(requestAnimationFrameLoop);
    }
    return callbacks.length - 1;
  }
  function caf(id) {
    callbacks[id] = void 0;
  }
  function requestAnimationFrame$1(cb) {
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      return window.requestAnimationFrame(cb);
    }
    return raf(cb);
  }
  function cancelAnimationFrame$1(cb) {
    if (typeof window !== "undefined" && window.cancelAnimationFrame) {
      return window.cancelAnimationFrame(cb);
    }
    return caf(cb);
  }

  var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    DEG_TO_RAD: DEG_TO_RAD,
    RAD_TO_DEG: RAD_TO_DEG,
    cancelAnimationFrame: cancelAnimationFrame$1,
    clamp: clamp$1,
    defineShader: defineShader,
    degToRad: degToRad$1,
    getContext: getContext,
    getFloatArrayConstructor: getFloatArrayConstructor,
    getShaderName: getShaderName,
    getWireframeIndex: getWireframeIndex,
    hasValue: hasValue,
    highPrecision: highPrecision,
    isHex: isHex,
    isNull: isNull,
    isNumber: isNumber,
    isObject: isObject,
    isPowerOfTwo: isPowerOfTwo,
    isRegexp: isRegexp,
    isString: isString,
    isUndef: isUndef,
    isUniqueEdge: isUniqueEdge,
    isWebGL: isWebGL,
    isWebGL2: isWebGL2,
    now: now,
    omit: omit,
    parseShader: parseShader,
    pick: pick,
    radToDeg: radToDeg$1,
    requestAnimationFrame: requestAnimationFrame$1,
    typeOf: typeOf,
    uid: uid
  });

  class Clock {
    #lastTime = 0;
    #elapsedTime = 0;
    #start = false;
    running;
    constructor(running = true) {
      this.running = running;
    }
    start() {
      if (!this.#start) {
        this.reset();
        this.#start = true;
      }
    }
    stop() {
      this.getElapsedTime();
      this.#start = false;
      this.running = false;
    }
    reset() {
      this.#lastTime = now();
      this.#elapsedTime = 0;
    }
    getElapsedTime() {
      this.getDelta();
      return this.#elapsedTime;
    }
    getDelta() {
      let deltaTime = 0;
      if (this.running && !this.#start) {
        this.start();
        return 0;
      }
      if (this.#start) {
        const time = now();
        deltaTime = (time - this.#lastTime) / 1e3;
        this.#lastTime = time;
        this.#elapsedTime = this.#elapsedTime + deltaTime;
      }
      return deltaTime;
    }
  }

  const defaultOptions$1 = {
    autoStart: true
  };
  class Raf {
    options;
    #raf;
    #animating;
    #isVisible;
    #clock;
    #callback;
    constructor(cb, options = {}) {
      this.options = {
        ...options,
        ...defaultOptions$1
      };
      this.#clock = new Clock();
      this.reset();
      this.onVisibilityChange = this.onVisibilityChange.bind(this);
      this.#callback = () => {
        const time = this.#clock.getElapsedTime();
        cb && cb(time);
      };
      if (this.options.autoStart) {
        this.start();
      }
    }
    get visible() {
      return this.#isVisible;
    }
    get animating() {
      return this.#animating;
    }
    reset() {
      this.#animating = false;
      this.#isVisible = true;
      if (this.#raf !== void 0) {
        cancelAnimationFrame$1(this.#raf);
      }
    }
    get elapsedTime() {
      return this.#clock.getElapsedTime();
    }
    start() {
      if (this.#animating)
        return;
      this.#animating = true;
      this.#clock.start();
      this.tick();
      if (typeof window !== "undefined" && window.document) {
        window.document.addEventListener("visibilitychange", this.onVisibilityChange, false);
      }
    }
    stop() {
      this.#clock.stop();
      this.reset();
      if (typeof window !== "undefined" && window.document) {
        window.document.removeEventListener("visibilitychange", this.onVisibilityChange, false);
      }
    }
    tick() {
      if (!this.#animating || !this.#isVisible)
        return;
      this.#raf = requestAnimationFrame$1(() => {
        this.tick();
      });
      this.#callback();
    }
    onVisibilityChange() {
      if (typeof window !== "undefined" && window.document) {
        this.#isVisible = !window.document.hidden;
      }
      if (this.#isVisible) {
        this.reset();
        this.start();
      }
    }
  }

  class Event {
    type;
    constructor(type, params = {}) {
      this.type = type;
      (Object.getOwnPropertyNames(params) || []).forEach((key) => {
        this[key] = params[key];
      });
    }
  }
  class EventEmitter {
    fns;
    validateEventTypes;
    constructor({ validEventTypes = [/.*/] } = {}) {
      this.fns = /* @__PURE__ */ new Map();
      this.validateEventTypes = validEventTypes;
    }
    validateEventType(type) {
      let vs = this.validateEventTypes;
      if (!Array.isArray(this.validateEventTypes)) {
        vs = [this.validateEventTypes];
      }
      let isValid = true;
      vs.forEach((r) => {
        if (isRegexp(r) && !r.test(type)) {
          isValid = false;
        }
      });
      if (!isValid) {
        throw new Error(`Invalid Event Type: '${type}'.
Event type should be any of: ${vs}.`);
      }
    }
    on(type, handler, context) {
      this.validateEventType(type);
      if (isString(type)) {
        const names = type.split(" ");
        if (names.length > 1) {
          names.forEach((t) => {
            this.on(t, handler, context);
          });
          return this;
        }
      }
      if (!this.has(type)) {
        this.fns.set(type, []);
      }
      this.fns.get(type).push(handler);
      return this;
    }
    once(type, handler, context) {
      this.validateEventType(type);
      if (isString(type)) {
        const names = type.split(" ");
        if (names.length > 1) {
          names.forEach((t) => {
            this.once(t, handler, context);
          });
          return this;
        }
      }
      const onceHandler = (...args) => {
        this.off(type, onceHandler);
        handler.call(context || this, ...args);
      };
      return this.on(type, onceHandler, context);
    }
    off(type, handler, context) {
      this.validateEventType(type);
      if (isString(type)) {
        const names = type.split(" ");
        if (names.length > 1) {
          names.forEach((t) => {
            this.off(t, handler, context);
          });
          return this;
        }
      }
      const handlers = this.has(type);
      if (handlers) {
        if (handler) {
          const fns = handlers.filter((h) => h !== handler);
          this.fns.set(type, fns);
        } else {
          this.fns.delete(type);
        }
      }
      return this;
    }
    emit(type, args) {
      const eventObject = type instanceof Event ? type : new Event(type, args);
      this.validateEventType(eventObject.type);
      const fns = this.has(eventObject.type);
      if (fns) {
        return fns.map((fn) => fn.call(this, eventObject));
      }
    }
    has(type) {
      return this.fns.get(type);
    }
    clear() {
      this.fns.clear();
      return this;
    }
  }

  class Vector {
    elements = new (getFloatArrayConstructor())(2);
    fromArray(array, offset = 0) {
      let i = 0;
      for (; i < this.elements.length; i++) {
        this.elements[i] = array[offset + i];
      }
      return this;
    }
    toArray(out = [], offset = 0) {
      let i = 0;
      for (; i < this.elements.length; i++) {
        out[offset + i] = this.elements[i];
      }
      return out;
    }
  }

  class Vector2 extends Vector {
    elements = new (getFloatArrayConstructor())(2);
    constructor(x = 0, y = 0) {
      super();
      const v = this.elements;
      v[0] = x;
      v[1] = y;
    }
    get x() {
      return this.elements[0];
    }
    set x(x) {
      this.elements[0] = x;
    }
    get y() {
      return this.elements[1];
    }
    set y(y) {
      this.elements[1] = y;
    }
    fromObject(object) {
      const { x, y } = object;
      if (x !== void 0)
        this.x = x;
      if (y !== void 0)
        this.y = y;
      return this;
    }
    toObject() {
      return {
        x: this.x,
        y: this.y
      };
    }
    set(x, y) {
      this.x = x;
      this.y = y;
      return this;
    }
    setScalar(s) {
      return this.set(s, s);
    }
    add(vec) {
      add(this.elements, this.elements, vec.elements);
      return this;
    }
    addScalar(v) {
      add(this.elements, this.elements, [v, v]);
      return this;
    }
    subtract(vec) {
      subtract(this.elements, this.elements, vec.elements);
      return this;
    }
    subtractScalar(v) {
      subtract(this.elements, this.elements, [v, v]);
      return this;
    }
    multiply(vec) {
      multiply(this.elements, this.elements, vec.elements);
      return this;
    }
    multiplyScalar(v) {
      multiply(this.elements, this.elements, [v, v]);
      return this;
    }
    divide(vec) {
      divide(this.elements, this.elements, vec.elements);
      return this;
    }
    divideScalar(v) {
      divide(this.elements, this.elements, [v, v]);
      return this;
    }
    scale(s) {
      scale(this.elements, this.elements, s);
      return this;
    }
    distanceTo(vec) {
      return distance(this.elements, vec.elements);
    }
    length() {
      return length(this.elements);
    }
    distanceToSquared(v) {
      return squaredDistance(v.elements, this.elements);
    }
    angle() {
      return angle(this.elements, [1, 0]);
    }
    angleTo(v) {
      return angle(this.elements, v.elements);
    }
    dot(vec) {
      return dot(this.elements, vec.elements);
    }
    equals(vec) {
      return equals$1(this.elements, vec.elements);
    }
    cross(vec) {
      cross(this.elements, this.elements, vec.elements);
      return this;
    }
    negate() {
      negate(this.elements, this.elements);
      return this;
    }
    inverse() {
      inverse(this.elements, this.elements);
      return this;
    }
    lerp(vec, t) {
      lerp(this.elements, this.elements, vec.elements, t);
      return this;
    }
    normalize() {
      normalize$1(this.elements, this.elements);
      return this;
    }
    applyMatrix3(matrix) {
      transformMat3(this.elements, this.elements, matrix.elements);
      return this;
    }
    applyMatrix4(matrix) {
      transformMat4(this.elements, this.elements, matrix.elements);
      return this;
    }
    copy(vec2) {
      this.x = vec2.x;
      this.y = vec2.y;
      return this;
    }
    clone() {
      return new Vector2(this.x, this.y);
    }
    toString() {
      return `${this.constructor.name}(${this.elements.join(", ")})`;
    }
  }

  const tempArray$1 = [];
  class Quaternion extends Vector {
    elements = new (getFloatArrayConstructor())(4);
    #changeCallbacks = [];
    constructor(x = 0, y = 0, z = 0, w = 0) {
      super();
      const v = this.elements;
      v[0] = x;
      v[1] = y;
      v[2] = z;
      v[3] = w;
    }
    get x() {
      return this.elements[0];
    }
    set x(x) {
      this.elements[0] = x;
      this.triggerChange();
    }
    get y() {
      return this.elements[1];
    }
    set y(y) {
      this.elements[1] = y;
      this.triggerChange();
    }
    get z() {
      return this.elements[2];
    }
    set z(z) {
      this.elements[2] = z;
      this.triggerChange();
    }
    get w() {
      return this.elements[3];
    }
    set w(w) {
      this.elements[3] = w;
      this.triggerChange();
    }
    fromObject({ x, y, z, w }) {
      if (x !== void 0)
        this.x = x;
      if (y !== void 0)
        this.y = y;
      if (z !== void 0)
        this.z = z;
      if (w !== void 0)
        this.w = w;
      this.triggerChange();
      return this;
    }
    toObject() {
      return {
        x: this.x,
        y: this.y,
        z: this.z,
        w: this.w
      };
    }
    fromAxisAngle(axis, rad) {
      setAxisAngle(this.elements, axis.elements, rad);
      this.triggerChange();
      return this;
    }
    getAxisAngle(axis = new Vector3()) {
      const rad = getAxisAngle(tempArray$1, this.elements);
      axis.set(tempArray$1[0], tempArray$1[1], tempArray$1[2]);
      return rad;
    }
    fromEuler(e) {
      fromEuler(this.elements, radToDeg$1(e.x), radToDeg$1(e.y), radToDeg$1(e.z));
      this.triggerChange();
      return this;
    }
    fromMat3(m) {
      fromMat3(this.elements, m);
      return this;
    }
    set(x, y, z, w) {
      set(this.elements, x, y, z, w);
      this.triggerChange();
      return this;
    }
    length() {
      return length$1(this.elements);
    }
    multiply(a, b) {
      if (b) {
        multiply$1(this.elements, a.elements, b.elements);
      } else {
        multiply$1(this.elements, this.elements, a.elements);
      }
      this.triggerChange();
      return this;
    }
    slerp(q, t) {
      slerp(this.elements, this.elements, q.elements, t);
      this.triggerChange();
      return this;
    }
    invert() {
      invert(this.elements, this.elements);
      this.triggerChange();
      return this;
    }
    conjugate() {
      conjugate(this.elements, this.elements);
      this.triggerChange();
      return this;
    }
    normalize() {
      normalize$2(this.elements, this.elements);
      this.triggerChange();
      return this;
    }
    dot(q) {
      return dot$1(this.elements, q.elements);
    }
    angleTo(q) {
      return getAngle(this.elements, q.elements);
    }
    clone() {
      return new Quaternion().copy(this);
    }
    copy(q) {
      copy(this.elements, q.elements);
      this.triggerChange();
      return this;
    }
    equals(q) {
      return equals$2(this.elements, q.elements);
    }
    onChange(fn) {
      if (!this.#changeCallbacks.includes(fn)) {
        this.#changeCallbacks.push(fn);
      }
    }
    triggerChange() {
      this.#changeCallbacks.forEach((cb) => cb());
    }
    toString() {
      return `${this.constructor.name}(${this.elements.join(", ")})`;
    }
  }

  class Vector3 extends Vector {
    elements = new (getFloatArrayConstructor())(3);
    constructor(x = 0, y = 0, z = 0) {
      super();
      const v = this.elements;
      v[0] = x;
      v[1] = y;
      v[2] = z;
    }
    get x() {
      return this.elements[0];
    }
    set x(x) {
      this.elements[0] = x;
    }
    get y() {
      return this.elements[1];
    }
    set y(y) {
      this.elements[1] = y;
    }
    get z() {
      return this.elements[2];
    }
    set z(z) {
      this.elements[2] = z;
    }
    fromObject(object) {
      const { x, y, z } = object;
      if (x !== void 0)
        this.x = x;
      if (y !== void 0)
        this.y = y;
      if (z !== void 0)
        this.z = z;
      return this;
    }
    toObject() {
      return {
        x: this.x,
        y: this.y,
        z: this.z
      };
    }
    set(x, y, z) {
      set$2(this.elements, x, y, z);
      return this;
    }
    setScalar(s) {
      return this.set(s, s, s);
    }
    length() {
      return length$3(this.elements);
    }
    add(vec) {
      add$2(this.elements, this.elements, vec.elements);
      return this;
    }
    addScalar(v) {
      add$2(this.elements, this.elements, [v, v, v]);
      return this;
    }
    subtract(vec) {
      subtract$2(this.elements, this.elements, vec.elements);
      return this;
    }
    subtractScalar(v) {
      subtract$2(this.elements, this.elements, [v, v, v]);
      return this;
    }
    subVectors(a, b) {
      subtract$2(this.elements, a.elements, b.elements);
      return this;
    }
    multiply(vec) {
      multiply$3(this.elements, this.elements, vec.elements);
      return this;
    }
    multiplyScalar(v) {
      multiply$3(this.elements, this.elements, [v, v, v]);
      return this;
    }
    divide(vec) {
      divide$2(this.elements, this.elements, vec.elements);
      return this;
    }
    divideScalar(v) {
      divide$2(this.elements, this.elements, [v, v, v]);
      return this;
    }
    scale(s) {
      scale$2(this.elements, this.elements, s);
      return this;
    }
    scaleAndAdd(v, s) {
      scaleAndAdd$1(this.elements, this.elements, v.elements, s);
      return this;
    }
    distanceTo(vec) {
      return distance$2(this.elements, vec.elements);
    }
    distanceToSquared(vec) {
      return squaredDistance$2(this.elements, vec.elements);
    }
    angle(vector) {
      return angle$1(this.elements, [1, 0, 0]);
    }
    angleTo(vector) {
      return angle$1(this.elements, vector.elements);
    }
    dot(vec) {
      return dot$3(this.elements, vec.elements);
    }
    equals(vec) {
      return equals$3(this.elements, vec.elements);
    }
    cross(vec) {
      cross$2(this.elements, this.elements, vec.elements);
      return this;
    }
    negate() {
      negate$2(this.elements, this.elements);
      return this;
    }
    inverse() {
      inverse$2(this.elements, this.elements);
      return this;
    }
    lerp(vec, t) {
      lerp$2(this.elements, this.elements, vec.elements, t);
      return this;
    }
    normalize() {
      normalize$4(this.elements, this.elements);
      return this;
    }
    applyEuler(euler) {
      const e = new Quaternion().fromEuler(euler);
      return this.applyQuaternion(e);
    }
    applyMatrix3(matrix) {
      transformMat3$1(this.elements, this.elements, matrix.elements);
      return this;
    }
    applyMatrix4(matrix) {
      transformMat4$2(this.elements, this.elements, matrix.elements);
      return this;
    }
    applyQuaternion(quaternion) {
      transformQuat$1(this.elements, this.elements, quaternion.elements);
      return this;
    }
    copy(vec3) {
      this.x = vec3.x;
      this.y = vec3.y;
      this.z = vec3.z;
      return this;
    }
    clone() {
      return new Vector3(this.x, this.y, this.z);
    }
    toString() {
      return `${this.constructor.name}(${this.elements.join(", ")})`;
    }
  }

  class Vector4 extends Vector {
    elements = new (getFloatArrayConstructor())(4);
    constructor(x = 0, y = 0, z = 0, w = 0) {
      super();
      const v = this.elements;
      v[0] = x;
      v[1] = y;
      v[2] = z;
      v[3] = w;
    }
    get x() {
      return this.elements[0];
    }
    set x(x) {
      this.elements[0] = x;
    }
    get y() {
      return this.elements[1];
    }
    set y(y) {
      this.elements[1] = y;
    }
    get z() {
      return this.elements[2];
    }
    set z(z) {
      this.elements[2] = z;
    }
    get w() {
      return this.elements[3];
    }
    set w(w) {
      this.elements[3] = w;
    }
    fromObject(object) {
      const { x, y, z, w } = object;
      if (x !== void 0)
        this.x = x;
      if (y !== void 0)
        this.y = y;
      if (z !== void 0)
        this.z = z;
      if (w !== void 0)
        this.w = w;
      return this;
    }
    toObject() {
      return {
        x: this.x,
        y: this.y,
        z: this.z,
        w: this.w
      };
    }
    set(x, y, z, w) {
      set$1(this.elements, x, y, z, w);
      return this;
    }
    setScalar(s) {
      return this.set(s, s, s, s);
    }
    add(vec) {
      add$1(this.elements, this.elements, vec.elements);
      return this;
    }
    addScalar(v) {
      add$1(this.elements, this.elements, [v, v, v, v]);
      return this;
    }
    subtract(vec) {
      subtract$1(this.elements, this.elements, vec.elements);
      return this;
    }
    subtractScalar(v) {
      subtract$1(this.elements, this.elements, [v, v, v, v]);
      return this;
    }
    subVectors(a, b) {
      subtract$1(this.elements, a.elements, b.elements);
      return this;
    }
    multiply(vec) {
      multiply$2(this.elements, this.elements, vec.elements);
      return this;
    }
    multiplyScalar(v) {
      multiply$2(this.elements, this.elements, [v, v, v, v]);
      return this;
    }
    divide(vec) {
      divide$1(this.elements, this.elements, vec.elements);
      return this;
    }
    divideScalar(v) {
      divide$1(this.elements, this.elements, [v, v, v, v]);
      return this;
    }
    scale(s) {
      scale$1(this.elements, this.elements, s);
      return this;
    }
    scaleAndAdd(v, s) {
      scaleAndAdd(this.elements, this.elements, v.elements, s);
      return this;
    }
    distanceTo(vec) {
      return distance$1(this.elements, vec.elements);
    }
    distanceToSquared(vec) {
      return squaredDistance$1(this.elements, vec.elements);
    }
    length() {
      return length$2(this.elements);
    }
    dot(vec) {
      return dot$2(this.elements, vec.elements);
    }
    equals(vec) {
      return equals$2(this.elements, vec.elements);
    }
    cross(vec) {
      cross$1(this.elements, this.elements, vec.elements);
      return this;
    }
    negate() {
      negate$1(this.elements, this.elements);
      return this;
    }
    inverse() {
      inverse$1(this.elements, this.elements);
      return this;
    }
    lerp(vec, t) {
      lerp$1(this.elements, this.elements, vec.elements, t);
      return this;
    }
    normalize() {
      normalize$3(this.elements, this.elements);
      return this;
    }
    applyMatrix4(matrix) {
      transformMat4$1(this.elements, this.elements, matrix.elements);
      return this;
    }
    applyQuaternion(quaternion) {
      transformQuat(this.elements, this.elements, quaternion.elements);
      return this;
    }
    copy(vec4) {
      this.x = vec4.x;
      this.y = vec4.y;
      this.z = vec4.z;
      this.w = vec4.w;
      return this;
    }
    clone() {
      return new Vector4(this.x, this.y, this.z, this.w);
    }
    toString() {
      return `${this.constructor.name}(${this.elements.join(", ")})`;
    }
  }

  class Matrix {
    elements = new (getFloatArrayConstructor())(16);
    fromArray(array, offset = 0) {
      let i = 0;
      for (; i < this.elements.length; i++) {
        this.elements[i] = array[offset + i];
      }
      return this;
    }
    toArray(out = [], offset = 0) {
      let i = 0;
      for (; i < this.elements.length; i++) {
        out[offset + i] = this.elements[i];
      }
      return out;
    }
  }

  class Matrix3 extends Matrix {
    elements = new (getFloatArrayConstructor())(9);
    constructor(m00 = 1, m01 = 0, m02 = 0, m10 = 0, m11 = 1, m12 = 0, m20 = 0, m21 = 0, m22 = 1) {
      super();
      const e = this.elements;
      e[0] = m00;
      e[1] = m01;
      e[2] = m02;
      e[3] = m10;
      e[4] = m11;
      e[5] = m12;
      e[6] = m20;
      e[7] = m21;
      e[8] = m22;
    }
    get x() {
      return this.elements[2];
    }
    get y() {
      return this.elements[5];
    }
    get z() {
      return this.elements[8];
    }
    static get identity() {
      return new Matrix3().fromArray(identity$1([]));
    }
    set(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
      set$4(this.elements, m00, m01, m02, m10, m11, m12, m20, m21, m22);
      return this;
    }
    transpose() {
      transpose$1(this.elements, this.elements);
      return this;
    }
    invert(m = this) {
      invert$2(this.elements, m.elements);
      return this;
    }
    adjoint(m = this) {
      adjoint$1(this.elements, m.elements);
      return this;
    }
    determinant() {
      return determinant$1(this.elements);
    }
    multiply(a, b) {
      if (b) {
        multiply$5(this.elements, a.elements, b.elements);
      } else {
        multiply$5(this.elements, this.elements, a.elements);
      }
      return this;
    }
    premultiply(a, b) {
      if (b) {
        multiply$5(this.elements, b.elements, a.elements);
      } else {
        multiply$5(this.elements, a.elements, this.elements);
      }
      return this;
    }
    translate(v) {
      translate$1(this.elements, this.elements, v.elements);
      return this;
    }
    rotate(rad) {
      rotate$1(this.elements, this.elements, rad);
      return this;
    }
    scale(v) {
      scale$4(this.elements, this.elements, v.elements);
      return this;
    }
    fromTranslation(v) {
      fromTranslation$1(this.elements, v.elements);
      return this;
    }
    fromRotation(rad) {
      fromRotation$1(this.elements, rad);
      return this;
    }
    fromScaling(v) {
      fromScaling$1(this.elements, v.elements);
      return this;
    }
    fromQuat(q) {
      fromQuat$1(this.elements, q.elements);
      return this;
    }
    normalFromMat4(m) {
      normalFromMat4(this.elements, m.elements);
      return this;
    }
    fromMat4(m) {
      fromMat4(this.elements, m.elements);
      return this;
    }
    frob() {
      return frob(this.elements);
    }
    add(a, b) {
      if (b) {
        add$4(this.elements, a.elements, b.elements);
      } else {
        add$4(this.elements, this.elements, a.elements);
      }
      return this;
    }
    subtract(a, b) {
      if (b) {
        subtract$4(this.elements, a.elements, b.elements);
      } else {
        subtract$4(this.elements, this.elements, a.elements);
      }
      return this;
    }
    equals(a, b) {
      if (b) {
        return equals$5(a.elements, b.elements);
      } else {
        return equals$5(this.elements, a.elements);
      }
    }
    fromRotationTranslationScale(rotation, x, y, scaleX, scaleY) {
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      this.set(scaleX * cos, -scaleY * sin, 0, scaleX * sin, scaleY * cos, 0, x, y, 1);
      return this;
    }
    getNormalMatrix(m) {
      normalFromMat4(this.elements, m.elements);
      return this;
    }
    copy(m) {
      copy$3(this.elements, m.elements);
      return this;
    }
    clone() {
      return new Matrix3().copy(this);
    }
    toString() {
      return `${this.constructor.name}(${this.elements.join(", ")})`;
    }
  }

  const tempArray = [];
  class Matrix4 extends Matrix {
    elements = new (getFloatArrayConstructor())(16);
    constructor(m00 = 1, m01 = 0, m02 = 0, m03 = 0, m10 = 0, m11 = 1, m12 = 0, m13 = 0, m20 = 0, m21 = 0, m22 = 1, m23 = 0, m30 = 0, m31 = 0, m32 = 0, m33 = 1) {
      super();
      const e = this.elements;
      e[0] = m00;
      e[1] = m01;
      e[2] = m02;
      e[3] = m03;
      e[4] = m10;
      e[5] = m11;
      e[6] = m12;
      e[7] = m13;
      e[8] = m20;
      e[9] = m21;
      e[10] = m22;
      e[11] = m23;
      e[12] = m30;
      e[13] = m31;
      e[14] = m32;
      e[15] = m33;
    }
    get x() {
      return this.elements[12];
    }
    get y() {
      return this.elements[13];
    }
    get z() {
      return this.elements[14];
    }
    get w() {
      return this.elements[15];
    }
    static get identity() {
      return new Matrix4().fromArray(identity([]));
    }
    set(m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33) {
      set$3(this.elements, m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33);
      return this;
    }
    transpose() {
      transpose(this.elements, this.elements);
      return this;
    }
    invert(m = this) {
      invert$1(this.elements, m.elements);
      return this;
    }
    adjoint(m = this) {
      adjoint(this.elements, m.elements);
      return this;
    }
    determinant() {
      return determinant(this.elements);
    }
    add(a, b) {
      if (b) {
        add$3(this.elements, a.elements, b.elements);
      } else {
        add$3(this.elements, this.elements, a.elements);
      }
      return this;
    }
    subtract(a, b) {
      if (b) {
        subtract$3(this.elements, a.elements, b.elements);
      } else {
        subtract$3(this.elements, this.elements, a.elements);
      }
      return this;
    }
    multiply(a, b) {
      if (b) {
        multiply$4(this.elements, a.elements, b.elements);
      } else {
        multiply$4(this.elements, this.elements, a.elements);
      }
      return this;
    }
    multiplyScalar(a = this, b) {
      multiplyScalar(this.elements, a.elements, b);
      return this;
    }
    premultiply(a, b) {
      if (b) {
        multiply$4(this.elements, b.elements, a.elements);
      } else {
        multiply$4(this.elements, a.elements, this.elements);
      }
      return this;
    }
    translate(v) {
      translate(this.elements, this.elements, v.elements);
      return this;
    }
    rotate(rad) {
      rotate(this.elements, this.elements, rad);
      return this;
    }
    scale(vec3) {
      scale$3(this.elements, this.elements, vec3.elements);
      return this;
    }
    scaleScalar(s) {
      scale$3(this.elements, this.elements, [s, s, s]);
      return this;
    }
    fromTranslation(vec) {
      fromTranslation(this.elements, vec.elements);
      return this;
    }
    fromRotation(rad, axis) {
      fromRotation(this.elements, rad, axis);
      return this;
    }
    fromRotationX(rad) {
      fromXRotation(this.elements, rad);
      return this;
    }
    fromRotationY(rad) {
      fromYRotation(this.elements, rad);
      return this;
    }
    fromRotationZ(rad) {
      fromZRotation(this.elements, rad);
      return this;
    }
    fromScale(vec) {
      fromScaling(this.elements, vec.elements);
      return this;
    }
    fromRotationTranslation(quat, v) {
      fromRotationTranslation(this.elements, quat.elements, v.elements);
      return this;
    }
    fromPerspective(fov, aspect, near, far) {
      perspective(this.elements, degToRad$1(fov), aspect, near, far);
      return this;
    }
    fromOrthogonal(left, right, bottom, top, near, far) {
      ortho(this.elements, left, right, bottom, top, near, far);
      return this;
    }
    fromQuat(q) {
      fromQuat(this.elements, q.elements);
      return this;
    }
    equals(mat4) {
      return equals$4(this.elements, mat4.value);
    }
    getRotation(q = new Quaternion()) {
      getRotation(tempArray, this.elements);
      q.set(tempArray[0], tempArray[1], tempArray[2], tempArray[3]);
      return q;
    }
    getScale(v = new Vector3()) {
      getScaling(tempArray, this.elements);
      v.set(tempArray[0], tempArray[1], tempArray[2]);
      return v;
    }
    getTranslation(v = new Vector3()) {
      getTranslation(tempArray, this.elements);
      v.set(tempArray[0], tempArray[1], tempArray[2]);
      return v;
    }
    rotateX(rad) {
      rotateX(this.elements, this.elements, rad);
      return this;
    }
    rotateY(rad) {
      rotateY(this.elements, this.elements, rad);
      return this;
    }
    rotateZ(rad) {
      rotateZ(this.elements, this.elements, rad);
      return this;
    }
    compose(v, q, s) {
      fromRotationTranslationScale(this.elements, q.elements, v.elements, s.elements);
      return this;
    }
    decompose() {
      return {
        rotation: this.getRotation(),
        scale: this.getScale(),
        translation: this.getTranslation()
      };
    }
    copy(m) {
      copy$2(this.elements, m.elements);
      return this;
    }
    clone() {
      return new Matrix4().copy(this);
    }
    toString() {
      return `${this.constructor.name}(${this.elements.join(", ")})`;
    }
  }

  class Euler extends Vector {
    elements = new (getFloatArrayConstructor())(3);
    #changeCallbacks = [];
    #order = "xyz";
    constructor(x = 0, y = 0, z = 0, order = "xyz") {
      super();
      const v = this.elements;
      v[0] = x;
      v[1] = y;
      v[2] = z;
      this.#order = order;
    }
    get x() {
      return this.elements[0];
    }
    set x(x) {
      this.elements[0] = x;
      this.triggerChange();
    }
    get y() {
      return this.elements[1];
    }
    set y(y) {
      this.elements[1] = y;
      this.triggerChange();
    }
    get z() {
      return this.elements[2];
    }
    set z(z) {
      this.elements[2] = z;
      this.triggerChange();
    }
    get order() {
      return this.#order;
    }
    set order(order) {
      this.#order = order;
      this.triggerChange();
    }
    get roll() {
      return this.x;
    }
    set roll(roll) {
      this.x = roll;
    }
    get pitch() {
      return this.y;
    }
    set pitch(pitch) {
      this.y = pitch;
    }
    get yaw() {
      return this.z;
    }
    set yaw(yaw) {
      this.z = yaw;
    }
    fromObject({ x, y, z, order }) {
      if (x !== void 0) {
        this.x = x;
      }
      if (y !== void 0) {
        this.y = y;
      }
      if (z !== void 0) {
        this.z = z;
      }
      if (order !== void 0) {
        this.order = order;
      }
      this.triggerChange();
      return this;
    }
    toObject() {
      return {
        x: this.x,
        y: this.y,
        z: this.z,
        order: this.order
      };
    }
    fromRotationMatrix(m, order = this.#order, update = true) {
      const te = m.toArray();
      const m11 = te[0];
      const m12 = te[4];
      const m13 = te[8];
      const m21 = te[1];
      const m22 = te[5];
      const m23 = te[9];
      const m31 = te[2];
      const m32 = te[6];
      const m33 = te[10];
      switch (order) {
        case "xyz":
          this.y = Math.asin(clamp$1(m13, -1, 1));
          if (Math.abs(m13) < 0.9999999) {
            this.x = Math.atan2(-m23, m33);
            this.z = Math.atan2(-m12, m11);
          } else {
            this.x = Math.atan2(m32, m22);
            this.z = 0;
          }
          break;
        case "yxz":
          this.x = Math.asin(-clamp$1(m23, -1, 1));
          if (Math.abs(m23) < 0.9999999) {
            this.y = Math.atan2(m13, m33);
            this.z = Math.atan2(m21, m22);
          } else {
            this.y = Math.atan2(-m31, m11);
            this.z = 0;
          }
          break;
        case "zxy":
          this.x = Math.asin(clamp$1(m32, -1, 1));
          if (Math.abs(m32) < 0.9999999) {
            this.y = Math.atan2(-m31, m33);
            this.z = Math.atan2(-m12, m22);
          } else {
            this.y = 0;
            this.z = Math.atan2(m21, m11);
          }
          break;
        case "zyx":
          this.y = Math.asin(-clamp$1(m31, -1, 1));
          if (Math.abs(m31) < 0.9999999) {
            this.x = Math.atan2(m32, m33);
            this.z = Math.atan2(m21, m11);
          } else {
            this.x = 0;
            this.z = Math.atan2(-m12, m22);
          }
          break;
        case "yzx":
          this.z = Math.asin(clamp$1(m21, -1, 1));
          if (Math.abs(m21) < 0.9999999) {
            this.x = Math.atan2(-m23, m22);
            this.y = Math.atan2(-m31, m11);
          } else {
            this.x = 0;
            this.y = Math.atan2(m13, m33);
          }
          break;
        case "xzy":
          this.z = Math.asin(-clamp$1(m12, -1, 1));
          if (Math.abs(m12) < 0.9999999) {
            this.x = Math.atan2(m32, m22);
            this.y = Math.atan2(m13, m11);
          } else {
            this.x = Math.atan2(-m23, m33);
            this.y = 0;
          }
          break;
        default:
          throw new Error("Unknown Euler angle order");
      }
      this.#order = order;
      if (update) {
        this.triggerChange();
      }
      return this;
    }
    fromQuaternion(q) {
      const [x, y, z, w] = q.elements;
      const a = y * y;
      const s = -2 * (a + z * z) + 1;
      const o = 2 * (x * y + w * z);
      let l = -2 * (x * z - w * y);
      const c = 2 * (y * z + w * x);
      const h = -2 * (x * x + a) + 1;
      l = l > 1 ? 1 : l;
      l = l < -1 ? -1 : l;
      const d = Math.atan2(c, h);
      const u = Math.asin(l);
      const f = Math.atan2(o, s);
      return new Euler(d, u, f, "zyx");
    }
    fromVector3(vec3, order = this.#order) {
      return this.set(vec3.x, vec3.y, vec3.z, order);
    }
    toQuaternion() {
      const t = Math.cos(0.5 * this.yaw);
      const e = Math.sin(0.5 * this.yaw);
      const n = Math.cos(0.5 * this.roll);
      const r = Math.sin(0.5 * this.roll);
      const i = Math.cos(0.5 * this.pitch);
      const a = Math.sin(0.5 * this.pitch);
      return new Quaternion(
        t * r * i - e * n * a,
        t * n * a + e * r * i,
        e * n * i - t * r * a,
        t * n * i + e * r * a
      );
    }
    toVector3() {
      return new Vector3(this.x, this.y, this.z);
    }
    set(x, y, z, order = this.#order) {
      this.elements[0] = x;
      this.elements[1] = y;
      this.elements[2] = z;
      this.#order = order;
      this.triggerChange();
      return this;
    }
    clone() {
      return new Euler().copy(this);
    }
    copy(euler) {
      let i = 0;
      for (; i < this.elements.length; i++) {
        this.elements[i] = euler.elements[i];
      }
      this.#order = euler.order;
      this.triggerChange();
      return this;
    }
    equals(e) {
      return this.x === e.x && this.y === e.y && this.z === e.z && this.order === e.order;
    }
    onChange(cb) {
      if (!this.#changeCallbacks.includes(cb)) {
        this.#changeCallbacks.push(cb);
      }
    }
    triggerChange() {
      this.#changeCallbacks.forEach((f) => f());
    }
    toString() {
      return `${this.constructor.name}(${this.elements.join(", ")})`;
    }
  }

  function namesPlugin(e,f){var a={white:"#ffffff",bisque:"#ffe4c4",blue:"#0000ff",cadetblue:"#5f9ea0",chartreuse:"#7fff00",chocolate:"#d2691e",coral:"#ff7f50",antiquewhite:"#faebd7",aqua:"#00ffff",azure:"#f0ffff",whitesmoke:"#f5f5f5",papayawhip:"#ffefd5",plum:"#dda0dd",blanchedalmond:"#ffebcd",black:"#000000",gold:"#ffd700",goldenrod:"#daa520",gainsboro:"#dcdcdc",cornsilk:"#fff8dc",cornflowerblue:"#6495ed",burlywood:"#deb887",aquamarine:"#7fffd4",beige:"#f5f5dc",crimson:"#dc143c",cyan:"#00ffff",darkblue:"#00008b",darkcyan:"#008b8b",darkgoldenrod:"#b8860b",darkkhaki:"#bdb76b",darkgray:"#a9a9a9",darkgreen:"#006400",darkgrey:"#a9a9a9",peachpuff:"#ffdab9",darkmagenta:"#8b008b",darkred:"#8b0000",darkorchid:"#9932cc",darkorange:"#ff8c00",darkslateblue:"#483d8b",gray:"#808080",darkslategray:"#2f4f4f",darkslategrey:"#2f4f4f",deeppink:"#ff1493",deepskyblue:"#00bfff",wheat:"#f5deb3",firebrick:"#b22222",floralwhite:"#fffaf0",ghostwhite:"#f8f8ff",darkviolet:"#9400d3",magenta:"#ff00ff",green:"#008000",dodgerblue:"#1e90ff",grey:"#808080",honeydew:"#f0fff0",hotpink:"#ff69b4",blueviolet:"#8a2be2",forestgreen:"#228b22",lawngreen:"#7cfc00",indianred:"#cd5c5c",indigo:"#4b0082",fuchsia:"#ff00ff",brown:"#a52a2a",maroon:"#800000",mediumblue:"#0000cd",lightcoral:"#f08080",darkturquoise:"#00ced1",lightcyan:"#e0ffff",ivory:"#fffff0",lightyellow:"#ffffe0",lightsalmon:"#ffa07a",lightseagreen:"#20b2aa",linen:"#faf0e6",mediumaquamarine:"#66cdaa",lemonchiffon:"#fffacd",lime:"#00ff00",khaki:"#f0e68c",mediumseagreen:"#3cb371",limegreen:"#32cd32",mediumspringgreen:"#00fa9a",lightskyblue:"#87cefa",lightblue:"#add8e6",midnightblue:"#191970",lightpink:"#ffb6c1",mistyrose:"#ffe4e1",moccasin:"#ffe4b5",mintcream:"#f5fffa",lightslategray:"#778899",lightslategrey:"#778899",navajowhite:"#ffdead",navy:"#000080",mediumvioletred:"#c71585",powderblue:"#b0e0e6",palegoldenrod:"#eee8aa",oldlace:"#fdf5e6",paleturquoise:"#afeeee",mediumturquoise:"#48d1cc",mediumorchid:"#ba55d3",rebeccapurple:"#663399",lightsteelblue:"#b0c4de",mediumslateblue:"#7b68ee",thistle:"#d8bfd8",tan:"#d2b48c",orchid:"#da70d6",mediumpurple:"#9370db",purple:"#800080",pink:"#ffc0cb",skyblue:"#87ceeb",springgreen:"#00ff7f",palegreen:"#98fb98",red:"#ff0000",yellow:"#ffff00",slateblue:"#6a5acd",lavenderblush:"#fff0f5",peru:"#cd853f",palevioletred:"#db7093",violet:"#ee82ee",teal:"#008080",slategray:"#708090",slategrey:"#708090",aliceblue:"#f0f8ff",darkseagreen:"#8fbc8f",darkolivegreen:"#556b2f",greenyellow:"#adff2f",seagreen:"#2e8b57",seashell:"#fff5ee",tomato:"#ff6347",silver:"#c0c0c0",sienna:"#a0522d",lavender:"#e6e6fa",lightgreen:"#90ee90",orange:"#ffa500",orangered:"#ff4500",steelblue:"#4682b4",royalblue:"#4169e1",turquoise:"#40e0d0",yellowgreen:"#9acd32",salmon:"#fa8072",saddlebrown:"#8b4513",sandybrown:"#f4a460",rosybrown:"#bc8f8f",darksalmon:"#e9967a",lightgoldenrodyellow:"#fafad2",snow:"#fffafa",lightgrey:"#d3d3d3",lightgray:"#d3d3d3",dimgray:"#696969",dimgrey:"#696969",olivedrab:"#6b8e23",olive:"#808000"},r={};for(var d in a)r[a[d]]=d;var l={};e.prototype.toName=function(f){if(!(this.rgba.a||this.rgba.r||this.rgba.g||this.rgba.b))return "transparent";var d,i,n=r[this.toHex()];if(n)return n;if(null==f?void 0:f.closest){var o=this.toRgb(),t=1/0,b="black";if(!l.length)for(var c in a)l[c]=new e(a[c]).toRgb();for(var g in a){var u=(d=o,i=l[g],Math.pow(d.r-i.r,2)+Math.pow(d.g-i.g,2)+Math.pow(d.b-i.b,2));u<t&&(t=u,b=g);}return b}};f.string.push([function(f){var r=f.toLowerCase(),d="transparent"===r?"#0000":a[r];return d?new e(d).toRgb():null},"name"]);}

  k([namesPlugin]);
  const normalize = (a, min, max) => {
    const hex = isHex(a);
    const diff = max - min;
    let v = clamp$1(Number.parseFloat(`${a}`), min, max);
    if (hex) {
      v = Number.parseInt("" + a * max, 10) / 100;
    }
    return Math.abs(v - max) < 1e-6 ? 1 : a % diff / diff;
  };
  class Color {
    r;
    g;
    b;
    a;
    constructor(v = 255, g, b, a = 1, isNormalized = false) {
      this.r = 1;
      this.g = 1;
      this.b = 1;
      this.a = 1;
      if (isUndef(g) && isUndef(b)) {
        if (isNumber(v) && v <= 255) {
          this.setRGBA(v, v, v, this.a, isNormalized);
        } else {
          const rgb = w(v).toRgb();
          if (rgb) {
            this.setRGBA(rgb.r, rgb.g, rgb.b, rgb.a);
          } else {
            console.error("Unsupported color value {".concat(String(v), "} provided"));
          }
        }
      } else {
        this.setRGBA(v, g, b, a);
      }
    }
    fromColor(c) {
      const color = w(c).toRgb();
      return this.setRGBA(color.r, color.g, color.b, color.a);
    }
    fromHSL(h, s, l, a = 1) {
      const color = w({
        h,
        s,
        l,
        a
      }).toRgb();
      return this.setRGBA(color.r, color.g, color.b, color.a);
    }
    fromHSV(h, s, v, a = 1) {
      const color = w({
        h,
        s,
        v,
        a
      }).toRgb();
      return this.setRGBA(color.r, color.g, color.b, color.a);
    }
    setRGB(r, g, b) {
      this.setRGBA(r, g, b, this.a);
      return this;
    }
    setRGBA(r, g, b, a, isNormalized) {
      this.r = isNormalized ? r : normalize(r, 0, 255);
      this.g = isNormalized ? g : normalize(g, 0, 255);
      this.b = isNormalized ? b : normalize(b, 0, 255);
      this.setAlpha(a);
      return this;
    }
    setAlpha(alpha) {
      if (alpha > 1) {
        this.a = normalize(alpha, 0, 255);
      } else {
        this.a = alpha;
      }
      return this;
    }
    toHex() {
      return w(this.toObject()).toHex();
    }
    toHSL() {
      return w(this.toObject()).toHsl();
    }
    toHSV() {
      return w(this.toObject()).toHsv();
    }
    toObject(isNormalized = false) {
      const m = isNormalized ? 1 : 255;
      return {
        r: this.r * m,
        g: this.g * m,
        b: this.b * m,
        a: this.a
      };
    }
    toArray() {
      return [this.r, this.g, this.b, this.a];
    }
    toVector() {
      return new Vector4().fromArray(this.toArray());
    }
    toVector3() {
      return new Vector3().fromArray(this.toArray());
    }
    toString() {
      return `${this.constructor.name}(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
    }
  }

  class ProjectionMatrix extends Matrix4 {
    frustum(mat4, left, right, top, bottom, near, far) {
      frustum(mat4.elements, left, right, bottom, top, near, far);
      return this;
    }
    orthographic(left, right, top, bottom, near, far) {
      ortho(this.elements, left, right, bottom, top, near, far);
      return this;
    }
    perspective(fovy, aspect, near, far) {
      perspective(this.elements, fovy, aspect, near, far);
      return this;
    }
    lookAt(eye, target = new Vector3(0, 0, 0), up = new Vector3(0, 1, 0)) {
      lookAt(this.elements, eye.elements, target.elements, up.elements);
      return this;
    }
    toString() {
      return `${this.constructor.name}(${this.elements.join(", ")})`;
    }
  }

  class Object3D {
    visible;
    localMatrix;
    worldMatrix;
    matrixAutoUpdate;
    position;
    scale;
    rotation;
    quaternion;
    up;
    children;
    parent;
    worldMatrixNeedsUpdate;
    constructor() {
      this.visible = true;
      this.localMatrix = new ProjectionMatrix();
      this.worldMatrix = new ProjectionMatrix();
      this.matrixAutoUpdate = true;
      this.position = new Vector3();
      this.scale = new Vector3(1, 1, 1);
      this.rotation = new Euler();
      this.quaternion = new Quaternion();
      this.up = new Vector3(0, 1, 0);
      this.parent = null;
      this.children = [];
      this.worldMatrixNeedsUpdate = false;
      this.rotation.onChange(() => {
        this.quaternion.fromEuler(this.rotation);
      });
      this.quaternion.onChange(() => {
        this.rotation.fromQuaternion(this.quaternion);
      });
    }
    add(object, notifyChild = true) {
      if (!this.contains(object)) {
        this.children.push(object);
      }
      if (notifyChild) {
        object.setParent(this, false);
      }
    }
    remove(object, notifyChild = true) {
      if (this.contains(object)) {
        this.children.splice(this.children.indexOf(object), 1);
      }
      if (notifyChild) {
        object.setParent(null, false);
      }
    }
    contains(object) {
      return this.children.includes(object);
    }
    setParent(object, notifyParent = true) {
      if (this.parent && object !== this.parent) {
        this.parent.remove(this, false);
      }
      this.parent = object;
      if (notifyParent && object) {
        object.add(this, false);
      }
    }
    traverse(callback) {
      if (!callback(this)) {
        for (let i = 0, l = this.children.length; i < l; i++) {
          this.children[i].traverse(callback);
        }
      }
    }
    lookAt(eye, invert) {
      if (invert) {
        this.localMatrix.lookAt(this.position, eye, this.up);
      } else {
        this.localMatrix.lookAt(eye, this.position, this.up);
      }
      this.localMatrix.getRotation(this.quaternion);
      this.rotation.fromQuaternion(this.quaternion);
    }
    updateMatrixWorld(force) {
      let f = force;
      if (this.matrixAutoUpdate) {
        this.updateMatrix();
      }
      if (this.worldMatrixNeedsUpdate || f) {
        if (this.parent === null) {
          this.worldMatrix.copy(this.localMatrix);
        } else {
          this.worldMatrix.multiply(this.parent.worldMatrix, this.localMatrix);
        }
        this.worldMatrixNeedsUpdate = false;
        f = true;
      }
      for (let i = 0, l = this.children.length; i < l; i++) {
        const child = this.children[i];
        child.updateMatrixWorld(f);
      }
    }
    updateMatrix() {
      this.localMatrix.compose(this.position, this.quaternion, this.scale);
      this.worldMatrixNeedsUpdate = true;
    }
    decompose() {
      this.localMatrix.getTranslation(this.position);
      this.localMatrix.getRotation(this.quaternion);
      this.localMatrix.getScale(this.scale);
      this.rotation.fromQuaternion(this.quaternion);
    }
    clone() {
      return new Object3D().copy(this, false);
    }
    copy(object, recursive) {
      this.visible = object.visible;
      this.position.copy(object.position);
      this.scale.copy(object.scale);
      this.rotation.copy(object.rotation);
      this.quaternion.copy(object.quaternion);
      this.up.copy(object.up);
      this.localMatrix.copy(object.localMatrix);
      this.worldMatrix.copy(object.worldMatrix);
      this.matrixAutoUpdate = object.matrixAutoUpdate;
      if (recursive) {
        for (let i = 0, n = object.children.length; i < n; i++) {
          const children = object.children[i];
          this.add(children.clone());
        }
      }
      return this;
    }
  }

  class Base {
    renderer;
    constructor(renderer) {
      this.renderer = renderer;
    }
    get gl() {
      return this.renderer.gl;
    }
    get rendererState() {
      return this.renderer.state;
    }
  }

  const getBufferType = (gl, data) => {
    if (data instanceof Float32Array || data instanceof Float64Array) {
      return gl.FLOAT;
    }
    if (data instanceof Uint16Array) {
      return gl.UNSIGNED_SHORT;
    }
    if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
      return gl.UNSIGNED_BYTE;
    }
    if (data instanceof Uint32Array) {
      return gl.UNSIGNED_INT;
    }
    if (data instanceof Int8Array) {
      return gl.BYTE;
    }
    if (data instanceof Int16Array) {
      return gl.SHORT;
    }
    if (data instanceof Int32Array) {
      return gl.INT;
    }
  };
  class BufferAttribute {
    id;
    data;
    type;
    size;
    instanced;
    stride;
    offset;
    divisor;
    normalized;
    needsUpdate;
    count;
    usage;
    target;
    buffer;
    constructor(renderer, attribute) {
      const attr = Object.assign(
        {},
        {
          size: 1,
          normalized: true,
          stride: 0,
          offset: 0,
          divisor: 0,
          usage: renderer.gl.STATIC_DRAW
        },
        attribute
      );
      this.id = uid("attribute");
      this.needsUpdate = false;
      if (!attribute.data || Array.isArray(attribute.data)) {
        throw new TypeError("BufferAttribute: data should be a typed array");
      }
      this.data = attr.data;
      this.size = attr.size || 1;
      this.type = attr.type || getBufferType(renderer.gl, attr.data);
      this.normalized = attr.normalized || false;
      this.stride = attr.stride || 0;
      this.offset = attr.offset || 0;
      this.divisor = attr.divisor || 0;
      this.instanced = attr.divisor > 0;
      this.usage = attr.usage || renderer.gl.STATIC_DRAW;
      if (attr.target) {
        this.target = attr.target;
      }
      let count = attr.count;
      if (attr.count === void 0 || attr.count === null) {
        count = attr.stride ? attr.data.byteLength / attr.stride : attr.data.length / attr.size;
      }
      this.count = count;
    }
  }

  const tempVec3 = new Vector3();
  class Geometry extends Base {
    #id;
    #attributes;
    #VAOs;
    #bounds;
    drawRange;
    instancedCount;
    isInstanced;
    drawMode;
    constructor(renderer, attributes = {}) {
      super(renderer);
      this.drawRange = {
        start: 0,
        count: 0
      };
      this.instancedCount = 0;
      this.isInstanced = false;
      this.#attributes = /* @__PURE__ */ new Map();
      this.#VAOs = /* @__PURE__ */ new Map();
      this.#id = uid("geometry");
      this.drawMode = this.gl.TRIANGLES;
      renderer.bindVertexArray(null);
      renderer.state.setActiveGeometry(null);
      for (const name in attributes) {
        const attribute = attributes[name];
        if (attribute instanceof BufferAttribute) {
          if (name === "index") {
            this.setIndex(attribute);
          } else {
            this.addAttribute(name, attribute);
          }
        } else {
          if (attribute.data) {
            const n = new BufferAttribute(this.renderer, attribute);
            if (name === "index") {
              this.setIndex(n);
            } else {
              this.addAttribute(name, n);
            }
          }
        }
      }
    }
    get id() {
      return this.#id;
    }
    get attributes() {
      return this.#attributes;
    }
    get attributesData() {
      const attributes = {};
      const iterator = this.#attributes.entries();
      for (let i = 0; i < this.#attributes.size; i++) {
        const entry = iterator.next().value;
        attributes[entry[0]] = omit(entry[1], [
          "id",
          "buffer"
        ]);
      }
      return attributes;
    }
    get index() {
      return this.attributes.get("index");
    }
    get bounds() {
      return this.#bounds;
    }
    set bounds(bounds) {
      this.#bounds = bounds;
    }
    addAttribute(name, attribute) {
      if (!attribute.target) {
        attribute.target = name === "index" ? this.gl.ELEMENT_ARRAY_BUFFER : this.gl.ARRAY_BUFFER;
      }
      attribute.needsUpdate = false;
      this.attributes.set(name, attribute);
      if (!attribute.buffer) {
        attribute.buffer = this.gl.createBuffer();
        this.updateAttribute(attribute);
      }
      if (attribute.divisor) {
        this.isInstanced = true;
        if (this.instancedCount && this.instancedCount !== attribute.count * attribute.divisor) {
          this.instancedCount = Math.min(this.instancedCount, attribute.count * attribute.divisor);
          return console.warn(
            `Geometry has multiple instanced buffers of different length - instancedCount: ${this.instancedCount}, count: ${attribute.count}, divisor: ${attribute.divisor}, attribute: ${name}`
          );
        }
        this.instancedCount = attribute.count * attribute.divisor;
      } else if (name === "index") {
        this.drawRange.count = attribute.count;
      } else if (!this.index) {
        this.drawRange.count = Math.max(this.drawRange.count, attribute.count);
      }
    }
    getAttribute(name) {
      return this.attributes.get(name);
    }
    setAttributeData(name, data) {
      const attribute = this.getAttribute(name);
      if (attribute) {
        attribute.data = data;
        attribute.needsUpdate = true;
      }
    }
    updateAttribute(attribute) {
      const createBuffer = !attribute.buffer;
      if (createBuffer) {
        attribute.buffer = this.gl.createBuffer();
      }
      if (this.rendererState.boundBuffer !== attribute.buffer) {
        this.gl.bindBuffer(attribute.target, attribute.buffer);
        this.rendererState.boundBuffer = attribute.buffer;
      }
      this.gl.bufferData(attribute.target, attribute.data, attribute.usage);
      attribute.needsUpdate = false;
    }
    removeAttribute(attribute) {
      this.attributes.delete(attribute);
    }
    setIndex(index) {
      if (index instanceof BufferAttribute) {
        index.size = 1;
        this.addAttribute("index", index);
      } else {
        const buffer = new BufferAttribute(this.renderer, {
          data: index.length > 65535 ? new Uint32Array(index) : new Uint16Array(index),
          size: 1
        });
        this.addAttribute("index", buffer);
      }
      this.drawRange.count = this.index?.count;
    }
    setVertices(data) {
      const array = [];
      const len = data.length;
      for (let i = 0; i < len; i++) {
        const item = data[i];
        array.push(item[0], item[1], item[2]);
      }
      this.addAttribute(
        "position",
        new BufferAttribute(this.renderer, {
          data: new Float32Array(array),
          size: 3
        })
      );
    }
    setNormals(data) {
      this.addAttribute(
        "normal",
        new BufferAttribute(this.renderer, {
          data: new Float32Array(data),
          size: 2
        })
      );
    }
    setUVs(data) {
      this.addAttribute(
        "uv",
        new BufferAttribute(this.renderer, {
          data: new Float32Array(data),
          size: 2
        })
      );
    }
    setColors(colors) {
      const data = [];
      for (let i = 0; i < colors.length; i++) {
        let color = colors[i];
        if (color && (color instanceof Vector3 || color instanceof Vector4)) {
          color = color.toArray();
        }
        data.push(color[0], color[1], color[2], color[3] || 1);
      }
      this.addAttribute(
        "color",
        new BufferAttribute(this.renderer, {
          data: new Float32Array(data),
          size: 4
        })
      );
    }
    setDrawRange(start, count) {
      this.drawRange.start = start;
      this.drawRange.count = count;
    }
    setInstancedCount(count) {
      this.instancedCount = count;
    }
    createVAO(program) {
      const { attributeOrder } = program;
      const vao = this.renderer.createVertexArray();
      this.renderer.bindVertexArray(vao);
      this.#VAOs.set(attributeOrder, vao);
      this.bindAttributes(program);
    }
    bindAttributes(program) {
      program.attributeLocations.forEach((location, { name, type }) => {
        const attributes = this.attributes.get(name);
        if (!attributes)
          return;
        this.gl.bindBuffer(attributes.target, attributes.buffer);
        this.rendererState.boundBuffer = attributes.buffer;
        let numLoc = 1;
        if (type === this.gl.FLOAT_MAT2)
          numLoc = 2;
        if (type === this.gl.FLOAT_MAT3)
          numLoc = 3;
        if (type === this.gl.FLOAT_MAT4)
          numLoc = 4;
        const size = attributes.size / numLoc;
        const stride = numLoc === 1 ? 0 : numLoc * numLoc * numLoc;
        const offset = numLoc === 1 ? 0 : numLoc * numLoc;
        for (let i = 0; i < numLoc; i++) {
          const attribIndex = location + i;
          this.gl.vertexAttribPointer(
            attribIndex,
            size,
            attributes.type,
            attributes.normalized,
            attributes.stride + stride,
            attributes.offset + offset
          );
          this.gl.enableVertexAttribArray(attribIndex);
          this.renderer.vertexAttribDivisor(attribIndex, attributes.divisor);
        }
      });
      const index = this.attributes.get("index");
      if (index) {
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, index.buffer);
      }
    }
    computeBoundingBox(vertices) {
      const { data, offset = 0, stride, size } = this.attributes.get("position");
      if (!this.#bounds) {
        this.#bounds = {
          min: new Vector3(),
          max: new Vector3(),
          center: new Vector3(),
          scale: new Vector3(),
          radius: Number.POSITIVE_INFINITY
        };
      }
      this.#bounds.min.setScalar(+Number.POSITIVE_INFINITY);
      this.#bounds.max.setScalar(Number.NEGATIVE_INFINITY);
      const array = vertices || data;
      const dl = stride || size;
      for (let i = offset; i < array.length; i += dl) {
        const x = array[i + 0];
        const y = array[i + 1];
        const z = array[i + 2];
        this.#bounds.min.x = Math.min(x, this.#bounds.min.x);
        this.#bounds.min.y = Math.min(y, this.#bounds.min.y);
        this.#bounds.min.z = Math.min(z, this.#bounds.min.z);
        this.#bounds.max.x = Math.max(x, this.#bounds.max.x);
        this.#bounds.max.y = Math.max(y, this.#bounds.max.y);
        this.#bounds.max.z = Math.max(z, this.#bounds.max.z);
      }
      this.#bounds.scale.subVectors(this.#bounds.max, this.#bounds.min);
      this.#bounds.center.add(this.#bounds.min).add(this.#bounds.max).divideScalar(2);
      return this.#bounds;
    }
    computeBoundingSphere(vertices) {
      const { data, offset = 0, stride, size } = this.attributes.get("position");
      if (!this.#bounds) {
        this.computeBoundingBox(vertices);
      }
      const array = vertices || data;
      let len = 0;
      const dl = stride || size;
      const length = array.length;
      for (let j = offset; j < length; j += dl) {
        tempVec3.fromArray(array, j);
        len = Math.max(len, this.#bounds.center.distanceToSquared(tempVec3));
      }
      this.#bounds.radius = Math.sqrt(len);
    }
    draw(program, drawMode = this.drawMode) {
      const { start, count } = this.drawRange;
      const activeGeometryId = `${this.id}_${program.attributeOrder}`;
      if (this.rendererState.activeGeometryId !== activeGeometryId) {
        const vao = this.#VAOs.get(program.attributeOrder);
        if (!vao) {
          this.createVAO(program);
        }
        this.renderer.bindVertexArray(this.#VAOs.get(program.attributeOrder));
        this.rendererState.activeGeometryId = activeGeometryId;
      }
      program.attributeLocations.forEach((location, { name }) => {
        const attribute = this.getAttribute(name);
        if (attribute && attribute.needsUpdate) {
          this.updateAttribute(attribute);
        }
      });
      if (this.isInstanced) {
        if (this.index) {
          const offset = this.index.offset + 2 * start;
          this.renderer.drawElementsInstanced(
            drawMode,
            count,
            this.index.type,
            offset,
            this.instancedCount
          );
        } else {
          this.renderer.drawArraysInstanced(drawMode, start, count, this.instancedCount);
        }
      } else if (this.index) {
        const offset = this.index.offset + 2 * start;
        this.gl.drawElements(drawMode, count, this.index.type, offset);
      } else {
        this.gl.drawArrays(drawMode, start, count);
      }
    }
    copy(source) {
      const attributes = source.attributesData;
      for (const name in attributes) {
        const attribute = attributes[name];
        if (attribute instanceof BufferAttribute) {
          if (name === "index") {
            this.setIndex(attribute);
          } else {
            this.addAttribute(name, attribute);
          }
        } else {
          if (attribute.data) {
            const n = new BufferAttribute(this.renderer, attribute);
            if (name === "index") {
              this.setIndex(n);
            } else {
              this.addAttribute(name, n);
            }
          }
        }
      }
      if (source.bounds) {
        this.bounds = {
          min: new Vector3().copy(source.bounds.min),
          max: new Vector3().copy(source.bounds.max),
          center: new Vector3().copy(source.bounds.center),
          scale: new Vector3().copy(source.bounds.scale),
          radius: source.bounds.radius
        };
      }
      return this;
    }
    clone() {
      const geometry = new Geometry(this.renderer, {}).copy(this);
      geometry.drawMode = this.drawMode;
      return geometry;
    }
    destroy() {
      this.#VAOs.forEach((t) => {
        this.renderer.deleteVertexArray(t);
      });
      this.#VAOs.clear();
      this.#attributes.forEach((t) => {
        this.gl.deleteBuffer(t.buffer);
      });
      this.#attributes.clear();
    }
  }

  class Mesh extends Object3D {
    gl;
    modelViewMatrix;
    normalMatrix;
    renderOrder;
    zDepth;
    frustumCulled;
    mode;
    renderer;
    #id;
    #lastMode;
    #geometry;
    #program;
    #wireframe;
    #wireframeGeometry;
    constructor(renderer, options = {}) {
      super();
      const opts = Object.assign({}, {
        mode: renderer.gl.TRIANGLES,
        frustumCulled: true,
        renderOrder: 0
      }, options);
      this.renderer = renderer;
      this.gl = this.renderer.gl;
      this.modelViewMatrix = new Matrix4();
      this.normalMatrix = new Matrix3();
      this.renderOrder = opts.renderOrder;
      this.frustumCulled = opts.frustumCulled;
      this.zDepth = 0;
      this.#id = opts.id || uid("mesh");
      this.#geometry = opts.geometry;
      this.#program = opts.program;
      this.#wireframe = Boolean(opts.wireframe);
      this.mode = opts.mode;
      this.#lastMode = opts.mode;
      if (this.#wireframe) {
        this.mode = this.gl.LINES;
        this.updateWireframeGeometry(this.#wireframe);
      }
    }
    get id() {
      return this.#id;
    }
    get geometry() {
      return this.#wireframe ? this.#wireframeGeometry : this.#geometry;
    }
    get program() {
      return this.#program;
    }
    set wireframe(wireframe) {
      this.mode = wireframe ? this.gl.LINES : this.#lastMode;
      this.#wireframe = wireframe;
      this.updateWireframeGeometry(this.#wireframe);
    }
    get wireframe() {
      return this.#wireframe;
    }
    draw(options = {}) {
      const { camera, target } = options;
      const uniforms = {};
      if (camera) {
        Object.assign(uniforms, {
          projectionMatrix: camera.projectionMatrix,
          cameraPosition: camera.worldPosition,
          viewMatrix: camera.viewMatrix
        });
        this.modelViewMatrix.multiply(camera.viewMatrix, this.worldMatrix);
        this.normalMatrix.getNormalMatrix(this.modelViewMatrix);
      } else {
        this.modelViewMatrix.copy(this.worldMatrix);
      }
      Object.assign(uniforms, {
        resolution: new Vector2(
          this.renderer.state?.viewport?.width || 1,
          this.renderer.state?.viewport?.height || 1
        ),
        modelMatrix: this.worldMatrix,
        modelViewMatrix: this.modelViewMatrix,
        normalMatrix: this.normalMatrix
      });
      Object.keys(uniforms).forEach((key) => {
        if (!Object.hasOwn(this.program.uniforms, key)) {
          this.program.uniforms[key] = { value: null };
        }
        this.program.uniforms[key].value = uniforms[key];
      });
      if (target)
        target.bind();
      this.program.use();
      this.geometry.draw(this.program, this.mode);
      if (target)
        target.unbind();
    }
    updateWireframeGeometry(wireframe, force = false) {
      if (this.#geometry && (force || !this.#wireframeGeometry)) {
        if (this.#wireframeGeometry) {
          this.#wireframeGeometry.destroy();
        }
        const attributes = this.#geometry.attributes;
        const positionArray = attributes.get("position")?.data;
        const indexAttribute = this.#geometry.index?.data;
        const numIndices = indexAttribute ? indexAttribute.length : Math.floor(positionArray.length / 3);
        const index = [];
        if (this.#geometry.index) {
          if (indexAttribute) {
            getWireframeIndex(positionArray, index, numIndices, indexAttribute);
          }
        } else {
          getWireframeIndex(positionArray, index, numIndices);
        }
        const indices = index.length > 65536 ? new Uint32Array(index) : new Uint16Array(index);
        this.#wireframeGeometry = new Geometry(this.renderer, {
          ...this.#geometry.attributesData,
          index: {
            data: indices
          }
        });
      }
    }
    updateGeometry(geometry, destroy = true) {
      if (destroy && this.#geometry) {
        this.#geometry.destroy();
      }
      this.#geometry = geometry;
      this.updateWireframeGeometry(this.#wireframe, true);
    }
    updateProgram(program, destroy = true) {
      if (destroy && this.#program) {
        this.#program.destroy();
      }
      this.#program = program;
    }
    destroy() {
      this.program.destroy();
      this.geometry.destroy();
    }
    clone() {
      return new Mesh(this.gl, {
        geometry: this.geometry,
        program: this.program,
        frustumCulled: this.frustumCulled,
        mode: this.mode,
        renderOrder: this.renderOrder
      }).copy(this);
    }
    copy(mesh, recursive = true) {
      super.copy(mesh, recursive);
      this.modelViewMatrix.copy(mesh.modelViewMatrix);
      this.normalMatrix.copy(mesh.normalMatrix);
      this.mode = mesh.mode;
      this.renderOrder = mesh.renderOrder;
      this.zDepth = mesh.zDepth;
      return this;
    }
  }

  class Scene extends Object3D {
    clone() {
      return new Scene().copy(this, false);
    }
    copy(source, recursive) {
      super.copy(source, recursive);
      this.matrixAutoUpdate = source.matrixAutoUpdate;
      return this;
    }
  }

  var BlendType = /* @__PURE__ */ ((BlendType2) => {
    BlendType2[BlendType2["NoBlending"] = 0] = "NoBlending";
    BlendType2[BlendType2["NormalBlending"] = 1] = "NormalBlending";
    BlendType2[BlendType2["AdditiveBlending"] = 2] = "AdditiveBlending";
    BlendType2[BlendType2["SubtractiveBlending"] = 3] = "SubtractiveBlending";
    BlendType2[BlendType2["MultiplyBlending"] = 4] = "MultiplyBlending";
    BlendType2[BlendType2["CustomBlending"] = 5] = "CustomBlending";
    return BlendType2;
  })(BlendType || {});
  class State extends Base {
    #state;
    constructor(renderer, options) {
      super(renderer);
      const { gl } = renderer;
      this.#state = {
        viewport: {
          x: 0,
          y: 0,
          width: 0,
          height: 0
        }
      };
      this.apply(
        options || {
          frontFace: gl.CCW,
          depthTest: false,
          depthWrite: true,
          depthMask: true,
          depthFunc: gl.LESS,
          blending: 1 /* NormalBlending */,
          blendFunc: {
            src: gl.ONE,
            dst: gl.ZERO
          },
          blendEquation: {
            modeRGB: gl.FUNC_ADD
          },
          premultiplyAlpha: false,
          unpackAlignment: 4,
          flipY: false,
          framebuffer: null,
          textureUnits: [],
          activeTextureUnit: -1,
          activeGeometryId: -1,
          currentProgramId: -1,
          clearAlpha: 1,
          clearColor: new Color(0),
          stencil: {
            func: {},
            opFront: {},
            opBack: {}
          }
        }
      );
    }
    get state() {
      return this.#state;
    }
    get viewport() {
      return this.#state.viewport;
    }
    get textureUnits() {
      return this.#state.textureUnits;
    }
    get activeTextureUnit() {
      return this.#state.activeTextureUnit;
    }
    set activeTextureUnit(activeTextureUnit) {
      this.#state.activeTextureUnit = activeTextureUnit;
    }
    get currentProgramId() {
      return this.#state.currentProgramId;
    }
    set currentProgramId(id) {
      this.#state.currentProgramId = id;
    }
    get activeGeometryId() {
      return this.#state.activeGeometryId;
    }
    set activeGeometryId(id) {
      this.#state.activeGeometryId = id;
    }
    set flipY(flipY) {
      this.#state.flipY = flipY;
    }
    get flipY() {
      return this.#state.flipY;
    }
    set unpackAlignment(unpackAlignment) {
      this.#state.unpackAlignment = unpackAlignment;
    }
    get unpackAlignment() {
      return this.#state.unpackAlignment;
    }
    set premultiplyAlpha(premultiplyAlpha) {
      this.#state.premultiplyAlpha = premultiplyAlpha;
    }
    get premultiplyAlpha() {
      return this.#state.premultiplyAlpha;
    }
    set boundBuffer(boundBuffer) {
      this.#state.boundBuffer = boundBuffer;
    }
    get boundBuffer() {
      return this.#state.boundBuffer;
    }
    set anisotropy(anisotropy) {
      this.#state.anisotropy = anisotropy;
    }
    get anisotropy() {
      return this.#state.anisotropy;
    }
    apply(options) {
      if (options.blending !== void 0 && options.blending !== null) {
        this.setBlending(options.blending, options);
      } else {
        if (options.blendFunc) {
          const { src, dst, srcAlpha, dstAlpha } = options.blendFunc;
          this.setBlendFunc(src, dst, srcAlpha, dstAlpha);
          this.enable(this.gl.BLEND);
        } else {
          this.disable(this.gl.BLEND);
        }
        if (options.blendEquation) {
          const { modeRGB, modeAlpha } = options.blendEquation;
          this.setBlendEquation(modeRGB, modeAlpha);
        }
      }
      if (!isUndef(options.cullFace) && !isNull(options.cullFace)) {
        this.setCullFace(options.cullFace);
      }
      if (!isUndef(options.frontFace) && !isNull(options.frontFace)) {
        this.setFrontFace(options.frontFace);
      }
      if (options.depthTest) {
        this.enable(this.gl.DEPTH_TEST);
      } else {
        this.disable(this.gl.DEPTH_TEST);
      }
      if (!isUndef(options.depthMask) && !isNull(options.depthMask)) {
        this.setDepthMask(options.depthMask);
      }
      if (!isUndef(options.depthWrite) && !isNull(options.depthWrite)) {
        this.setDepthMask(options.depthWrite);
      }
      if (!isUndef(options.depthFunc) && !isNull(options.depthFunc)) {
        this.setDepthFunc(options.depthFunc);
      }
      if (!isUndef(options.lineWidth) && !isNull(options.lineWidth)) {
        this.setLineWidth(options.lineWidth);
      }
      this.#state = Object.assign(this.#state, options);
    }
    enable(id) {
      if (this.#state[id] !== true) {
        this.gl.enable(id);
        this.#state[id] = true;
      }
    }
    disable(id) {
      if (this.#state[id] !== false) {
        this.gl.disable(id);
        this.#state[id] = false;
      }
    }
    setViewport(width, height, x = 0, y = 0) {
      if (this.#state.viewport.width === width && this.#state.viewport.height === height)
        return;
      this.gl.viewport(x, y, width, height);
      this.#state.viewport = {
        width,
        height,
        x,
        y
      };
    }
    setMask(colorMask) {
      if (this.#state.colorMask !== colorMask) {
        this.gl.colorMask(colorMask, colorMask, colorMask, colorMask);
        this.#state.colorMask = colorMask;
      }
    }
    setBlending(blending, options) {
      this.#state.blending = blending;
      if (blending === 0 /* NoBlending */) {
        this.disable(this.gl.BLEND);
        return;
      } else {
        this.enable(this.gl.BLEND);
      }
      if (blending === 2 /* AdditiveBlending */) {
        if (this.#state.premultiplyAlpha) {
          this.setBlendEquation(this.gl.FUNC_ADD, this.gl.FUNC_ADD);
          this.setBlendFunc(this.gl.ONE, this.gl.ONE, this.gl.ONE, this.gl.ONE);
        } else {
          this.setBlendEquation(this.gl.FUNC_ADD);
          this.setBlendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
        }
      } else if (blending === 3 /* SubtractiveBlending */) {
        if (this.#state.premultiplyAlpha) {
          this.setBlendEquation(this.gl.FUNC_ADD, this.gl.FUNC_ADD);
          this.setBlendFunc(
            this.gl.ZERO,
            this.gl.ZERO,
            this.gl.ONE_MINUS_SRC_COLOR,
            this.gl.ONE_MINUS_SRC_ALPHA
          );
        } else {
          this.setBlendEquation(this.gl.FUNC_ADD);
          this.setBlendFunc(this.gl.ZERO, this.gl.ONE_MINUS_SRC_COLOR);
        }
      } else if (blending === 4 /* MultiplyBlending */) {
        if (this.#state.premultiplyAlpha) {
          this.setBlendEquation(this.gl.FUNC_ADD, this.gl.FUNC_ADD);
          this.setBlendFunc(this.gl.ZERO, this.gl.SRC_COLOR, this.gl.ZERO, this.gl.SRC_ALPHA);
        } else {
          this.setBlendEquation(this.gl.FUNC_ADD);
          this.setBlendFunc(this.gl.ZERO, this.gl.SRC_COLOR);
        }
      } else if (blending === 1 /* NormalBlending */) {
        if (this.#state.premultiplyAlpha) {
          this.setBlendEquation(this.gl.FUNC_ADD, this.gl.FUNC_ADD);
          this.setBlendFunc(
            this.gl.ONE,
            this.gl.ONE_MINUS_SRC_ALPHA,
            this.gl.ONE,
            this.gl.ONE_MINUS_SRC_ALPHA
          );
        } else {
          this.setBlendEquation(this.gl.FUNC_ADD, this.gl.FUNC_ADD);
          this.setBlendFunc(
            this.gl.SRC_ALPHA,
            this.gl.ONE_MINUS_SRC_ALPHA,
            this.gl.ONE,
            this.gl.ONE_MINUS_SRC_ALPHA
          );
        }
      } else if (blending === 5 /* CustomBlending */) {
        if (options?.blendFunc) {
          const { src, dst, srcAlpha, dstAlpha } = options.blendFunc;
          this.setBlendFunc(src, dst, srcAlpha, dstAlpha);
          this.enable(this.gl.BLEND);
        }
        if (options?.blendEquation) {
          const { modeRGB, modeAlpha } = options.blendEquation;
          this.setBlendEquation(modeRGB, modeAlpha);
        }
      } else {
        console.error("State: Invalid blending: ", blending);
      }
    }
    setBlendFunc(src, dst, srcAlpha, dstAlpha) {
      if (src !== this.#state.blendFunc?.src || dst !== this.#state.blendFunc?.dst || srcAlpha !== this.#state.blendFunc?.srcAlpha || dstAlpha !== this.#state.blendFunc?.dstAlpha) {
        this.#state.blendFunc = {
          src,
          dst,
          srcAlpha,
          dstAlpha
        };
        if (!isUndef(srcAlpha) && !isNull(srcAlpha) && !isUndef(dstAlpha) && !isNull(dstAlpha)) {
          this.gl.blendFuncSeparate(src, dst, srcAlpha, dstAlpha);
        } else {
          this.gl.blendFunc(src, dst);
        }
      }
    }
    setBlendEquation(modeRGB, modeAlpha) {
      if (modeRGB !== this.#state.blendEquation?.modeRGB || modeAlpha !== this.#state.blendEquation?.modeAlpha) {
        this.#state.blendEquation = {
          modeRGB,
          modeAlpha
        };
        if (!isUndef(modeAlpha) && !isNull(modeAlpha)) {
          this.gl.blendEquationSeparate(modeRGB, modeAlpha);
        } else {
          this.gl.blendEquation(modeRGB);
        }
      }
    }
    setClearAlpha(alpha) {
      if (this.#state.clearAlpha !== alpha) {
        this.#state.clearAlpha = alpha;
      }
    }
    setClearColor(color, alpha) {
      if (this.#state.clearAlpha !== alpha || this.#state.clearColor !== color) {
        this.#state.clearColor = color;
        if (!isUndef(alpha) && !isNull(alpha)) {
          this.#state.clearAlpha = alpha;
        } else {
          this.#state.clearAlpha = color.a;
        }
        this.gl.clearColor(color.r, color.g, color.b, this.#state.clearAlpha);
      }
    }
    setCullFace(cullFace) {
      if (this.#state.cullFace !== cullFace) {
        if (cullFace) {
          this.gl.enable(this.gl.CULL_FACE);
        } else {
          this.gl.disable(this.gl.CULL_FACE);
        }
        this.#state.cullFace = cullFace;
        this.gl.cullFace(cullFace);
      }
    }
    setFrontFace(frontFace) {
      if (this.#state.frontFace !== frontFace) {
        this.#state.frontFace = frontFace;
        this.gl.frontFace(frontFace);
      }
    }
    setDepthMask(mask) {
      if (this.#state.depthMask !== mask) {
        this.#state.depthMask = mask;
        this.gl.depthMask(mask);
      }
    }
    setDepthFunc(func) {
      if (this.#state.depthFunc !== func) {
        this.#state.depthFunc = func;
        this.gl.depthFunc(func);
      }
    }
    setDepthTest(state) {
      if (this.#state.depthTest !== state) {
        this.#state.depthTest = state;
        if (state) {
          this.enable(this.gl.DEPTH_TEST);
        } else {
          this.disable(this.gl.DEPTH_TEST);
        }
      }
    }
    setStencilFunc(cmp, ref, mask, face) {
      if (this.#state?.stencil?.func?.cmp !== cmp || this.#state?.stencil?.func?.ref !== ref || this.#state?.stencil?.func?.mask !== mask) {
        if (!this.#state?.stencil) {
          this.#state.stencil = {};
        }
        if (!this.#state?.stencil?.func) {
          this.#state.stencil.func = {};
        }
        this.#state.stencil.func = {
          ref,
          mask,
          cmp
        };
        if (face) {
          this.gl.stencilFuncSeparate(face, cmp, ref, mask);
        } else {
          this.gl.stencilFunc(cmp, ref, mask);
        }
      }
    }
    setStencilOp(fail, zFail, zPass, face) {
      if (!this.#state?.stencil) {
        this.#state.stencil = {};
      }
      if (!face || face === this.gl.FRONT_AND_BACK) {
        return this.#state.stencil?.opFront?.fail !== fail || this.#state.stencil?.opFront?.zFail !== zFail || this.#state.stencil?.opFront?.zPass !== zPass || this.#state.stencil?.opBack?.fail !== fail || this.#state.stencil?.opBack?.zFail !== zFail || this.#state.stencil?.opBack?.zPass !== zPass;
      } else if (face === this.gl.FRONT) {
        return this.#state.stencil?.opFront?.fail !== fail || this.#state.stencil?.opFront?.zFail !== zFail || this.#state.stencil?.opFront?.zPass !== zPass;
      } else if (face === this.gl.BACK) {
        return this.#state.stencil?.opBack?.fail !== fail || this.#state.stencil?.opBack?.zFail !== zFail || this.#state.stencil?.opBack?.zPass !== zPass;
      }
    }
    setStencilMask(mask, face) {
      if (this.#state.stencil?.mask !== mask) {
        this.#state.stencil = {
          ...this.#state.stencil,
          mask
        };
        if (face) {
          this.gl.stencilMaskSeparate(face, mask);
        } else {
          this.gl.stencilMask(mask);
        }
      }
    }
    setActiveTexture(unit) {
      if (this.#state.activeTextureUnit !== unit) {
        this.#state.activeTextureUnit = unit;
        this.gl.activeTexture(this.gl.TEXTURE0 + unit);
      }
    }
    setLineWidth(width) {
      if (this.#state.lineWidth !== width) {
        this.#state.lineWidth = width;
        this.gl.lineWidth(width);
      }
    }
    setPolygonOffset(polygonOffset, factor, units) {
      if (polygonOffset) {
        this.enable(this.gl.POLYGON_OFFSET_FILL);
        if (this.#state.polygonOffsetFactor !== factor || this.#state.polygonOffsetUnits !== units) {
          this.gl.polygonOffset(factor, units);
          this.#state.polygonOffsetFactor = factor;
          this.#state.polygonOffsetUnits = units;
        }
      } else {
        this.disable(this.gl.POLYGON_OFFSET_FILL);
      }
    }
    bindFramebuffer(v = {}) {
      const { target = this.gl.FRAMEBUFFER, buffer = null } = v;
      if (this.#state.framebuffer !== buffer) {
        this.#state.framebuffer = buffer;
        this.gl.bindFramebuffer(target, buffer);
      }
    }
    setActiveGeometry(id) {
      this.#state.activeGeometryId = id;
    }
    reset(force = true) {
      const keys = Object.keys(this.#state);
      if (force) {
        keys.filter((key) => ["viewport", "premultiplyAlpha"].indexOf(key) < 0).forEach((key) => {
          delete this.#state[key];
        });
        this.bindFramebuffer({
          buffer: null
        });
        this.apply({
          frontFace: this.gl.CCW,
          depthTest: false,
          depthWrite: true,
          depthMask: true,
          depthFunc: this.gl.LESS,
          blending: 1 /* NormalBlending */,
          blendFunc: {
            src: this.gl.ONE,
            dst: this.gl.ZERO
          },
          blendEquation: {
            modeRGB: this.gl.FUNC_ADD
          },
          premultiplyAlpha: false,
          unpackAlignment: 4,
          flipY: false,
          framebuffer: null,
          textureUnits: [],
          activeTextureUnit: -1,
          activeGeometryId: -1,
          currentProgramId: -1,
          clearAlpha: 1,
          clearColor: new Color(0),
          stencil: {
            func: {},
            opFront: {},
            opBack: {}
          }
        });
      } else {
        keys.filter(
          (key) => [
            "flipY",
            "framebuffer",
            "textureUnits",
            "activeTextureUnit",
            "activeGeometryId",
            "currentProgramId"
          ].indexOf(key) > -1
        ).forEach((key) => {
          delete this.#state[key];
        });
        this.bindFramebuffer({
          buffer: null
        });
        this.#state.flipY = false;
        this.#state.activeGeometryId = -1;
        this.#state.activeTextureUnit = -1;
        this.#state.currentProgramId = -1;
        this.#state.textureUnits = [];
        this.#state.boundBuffer = null;
      }
    }
  }

  const external1ExtensionKeys = [
    "WEBGL_depth_texture",
    "OES_texture_half_float",
    "OES_texture_float",
    "OES_standard_derivatives",
    "OES_element_index_uint",
    "EXT_frag_depth",
    "EXT_blend_minmax",
    "EXT_shader_texture_lod",
    "WEBGL_draw_buffers",
    "WEBGL_color_buffer_float"
  ];
  const external2ExtensionKeys = [
    "EXT_color_buffer_float"
  ];
  const external12ExtensionKeys = [
    "WEBGL_lose_context",
    "OES_texture_half_float_linear",
    "OES_texture_float_linear",
    "EXT_color_buffer_half_float",
    "WEBGL_debug_renderer_info",
    "EXT_texture_filter_anisotropic"
  ];
  class Renderer {
    #gl;
    #state;
    #extensions;
    #autoClear;
    #depth;
    #alpha;
    #stencil;
    #antialias;
    #premultipliedAlpha;
    #preserveDrawingBuffer;
    #color;
    #dpr;
    #frustumCull;
    vertexAttribDivisor;
    drawArraysInstanced;
    drawElementsInstanced;
    createVertexArray;
    bindVertexArray;
    deleteVertexArray;
    width;
    height;
    constructor(gl, opts = {}) {
      const options = Object.assign(
        {},
        {
          autoClear: true,
          depth: true,
          alpha: false,
          stencil: false,
          antialias: false,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
          requestWebGl2: true,
          extensions: []
        },
        opts
      );
      this.#autoClear = Boolean(options.autoClear);
      this.#depth = options.depth;
      this.#alpha = options.alpha;
      this.#stencil = options.stencil;
      this.#antialias = options.antialias;
      this.#premultipliedAlpha = options.premultipliedAlpha;
      this.#preserveDrawingBuffer = options.preserveDrawingBuffer;
      this.#gl = isWebGL(gl) || isWebGL2(gl) ? gl : getContext(
        gl,
        {
          alpha: this.#alpha,
          depth: this.#depth,
          stencil: this.#stencil,
          antialias: this.#antialias,
          powerPreference: options.powerPreference,
          premultipliedAlpha: this.#premultipliedAlpha,
          preserveDrawingBuffer: this.#preserveDrawingBuffer
        },
        options.requestWebGl2
      );
      const attrs = this.#gl?.getContextAttributes();
      const viewport = this.#gl?.getParameter(this.#gl.VIEWPORT);
      const flipY = this.#gl?.getParameter(this.#gl.UNPACK_FLIP_Y_WEBGL);
      this.#state = new State(this);
      if (attrs) {
        this.#depth = Boolean(attrs.depth);
        this.#antialias = Boolean(attrs.antialias);
        this.#alpha = Boolean(attrs.alpha);
        this.#stencil = Boolean(attrs.stencil);
        this.#premultipliedAlpha = Boolean(attrs.premultipliedAlpha);
        this.#preserveDrawingBuffer = Boolean(attrs.preserveDrawingBuffer);
      }
      this.#state.flipY = Boolean(flipY);
      this.#state.setViewport(viewport[2], viewport[3], viewport[0], viewport[1]);
      this.#state.premultiplyAlpha = this.#premultipliedAlpha;
      this.#color = true;
      this.#dpr = options.dpr || 1;
      this.width = this.gl.canvas.width / this.#dpr;
      this.height = this.gl.canvas.height / this.#dpr;
      this.#frustumCull = !!options.frustumCull;
      this.#extensions = {};
      this.vertexAttribDivisor = this.getExtension(
        "ANGLE_instanced_arrays",
        "vertexAttribDivisor",
        "vertexAttribDivisorANGLE"
      );
      this.drawArraysInstanced = this.getExtension(
        "ANGLE_instanced_arrays",
        "drawArraysInstanced",
        "drawArraysInstancedANGLE"
      );
      this.drawElementsInstanced = this.getExtension(
        "ANGLE_instanced_arrays",
        "drawElementsInstanced",
        "drawElementsInstancedANGLE"
      );
      this.createVertexArray = this.getExtension(
        "OES_vertex_array_object",
        "createVertexArray",
        "createVertexArrayOES"
      );
      this.bindVertexArray = this.getExtension(
        "OES_vertex_array_object",
        "bindVertexArray",
        "bindVertexArrayOES"
      );
      this.deleteVertexArray = this.getExtension(
        "OES_vertex_array_object",
        "deleteVertexArray",
        "deleteVertexArrayOES"
      );
      if (options.extensions) {
        options.extensions.filter(
          (extension) => external1ExtensionKeys.findIndex((ext) => ext === extension) > -1
        ).forEach((extension) => {
          if (!this.#extensions[extension] && !this.isWebGL2) {
            this.#extensions[extension] = this.gl.getExtension(extension);
          }
        });
        options.extensions.filter(
          (extension) => external2ExtensionKeys.findIndex((ext) => ext === extension) > -1
        ).forEach((extension) => {
          if (!this.#extensions[extension] && this.isWebGL2) {
            this.#extensions[extension] = this.gl.getExtension(extension);
          }
        });
        options.extensions.filter(
          (extension) => external12ExtensionKeys.findIndex((ext) => ext === extension) > -1
        ).forEach((extension) => {
          if (!this.#extensions[extension]) {
            this.#extensions[extension] = this.gl.getExtension(extension);
          }
        });
      }
    }
    get gl() {
      return this.#gl;
    }
    get attributes() {
      return {
        dpr: this.#dpr,
        flipY: this.#state.flipY,
        depth: this.#depth,
        color: this.#color,
        antialias: this.#antialias,
        alpha: this.#alpha,
        stencil: this.#stencil,
        autoClear: this.#autoClear,
        frustumCull: this.#frustumCull,
        premultipliedAlpha: this.#premultipliedAlpha,
        preserveDrawingBuffer: this.#preserveDrawingBuffer
      };
    }
    get canvas() {
      return this.#gl.canvas;
    }
    get isWebGL() {
      return isWebGL(this.gl);
    }
    get isWebGL2() {
      return isWebGL2(this.gl);
    }
    get extensions() {
      return this.#extensions;
    }
    extension(key) {
      return this.#extensions[key];
    }
    get size() {
      return {
        width: "clientWidth" in this.canvas ? this.canvas.clientWidth : this.canvas.width,
        height: "clientHeight" in this.canvas ? this.canvas.clientHeight : this.canvas.height
      };
    }
    get state() {
      return this.#state;
    }
    get premultipliedAlpha() {
      return this.#premultipliedAlpha;
    }
    setSize(width, height) {
      this.width = width;
      this.height = height;
      this.gl.canvas.width = width * this.#dpr;
      this.gl.canvas.height = height * this.#dpr;
    }
    setViewport(width, height, x = 0, y = 0) {
      this.#state.setViewport(width, height, x, y);
    }
    getExtension(extension, method, extFunc) {
      const func = this.gl[method];
      if (method && func)
        return func.bind(this.gl);
      if (!this.#extensions[extension]) {
        this.#extensions[extension] = this.gl.getExtension(extension);
      }
      const ef = this.#extensions[extension];
      return method ? ef ? ef[extFunc].bind(ef) : null : ef;
    }
    getRenderList({ scene, camera }) {
      const renderList = [];
      scene.traverse((node) => {
        if (!node.visible)
          return true;
        if (!node.draw)
          return;
        if (this.#frustumCull && node.frustumCulled && camera) {
          if (!camera.frustumIntersectsMesh(node))
            return;
        }
        renderList.push(node);
      });
      return renderList;
    }
    render(params) {
      const { scene, camera, target = null, update = true, clear } = params;
      if (target === null) {
        this.#state.bindFramebuffer({
          buffer: null
        });
        this.setViewport(this.width * this.#dpr, this.height * this.#dpr);
      } else {
        target.bind();
        this.setViewport(target.width, target.height);
      }
      if (clear || this.#autoClear && clear !== false) {
        if (this.#depth && (!target || target.depth)) {
          this.#state.enable(this.gl.DEPTH_TEST);
          this.#state.setDepthMask(true);
        }
        this.clear(this.#color, this.#depth, this.#stencil);
      }
      if (update)
        scene.updateMatrixWorld();
      if (camera)
        camera.updateMatrixWorld();
      const renderList = this.getRenderList({ scene, camera });
      let i = 0;
      const len = renderList.length;
      for (; i < len; i++) {
        const node = renderList[i];
        node.draw({ camera });
      }
      if (target) {
        target.unbind();
      }
    }
    clear(color = this.#color, depth = this.#depth, stencil = this.#stencil) {
      let bits = 0;
      if (color)
        bits |= this.gl.COLOR_BUFFER_BIT;
      if (depth)
        bits |= this.gl.DEPTH_BUFFER_BIT;
      if (stencil)
        bits |= this.gl.STENCIL_BUFFER_BIT;
      this.gl.clear(bits);
    }
    resetState(force = true, vao = null) {
      this.#state.reset(force);
      this.bindVertexArray(vao);
    }
  }

  const ERR_RESOURCE_METHOD_UNDEFINED = "Resource subclass must define virtual methods";
  class Resource extends Base {
    #handle;
    #lastHandle;
    id;
    name;
    userData;
    byteLength;
    options;
    constructor(renderer, options = {}) {
      super(renderer);
      this.id = options?.id || uid(this.constructor.name);
      this.name = options?.name;
      this.userData = options?.userData;
      this.#handle = options?.handle;
      this.options = options;
      if (this.#handle === void 0) {
        this.#handle = this.createHandle();
      }
      this.byteLength = 0;
    }
    get handle() {
      return this.#handle;
    }
    swapHandle(handle) {
      this.#lastHandle = this.#handle;
      this.#handle = handle;
    }
    restoreHandle() {
      this.#handle = this.#lastHandle;
    }
    destroy() {
      this.delete();
    }
    delete({ deleteChildren = false } = {}) {
      const children = this.handle && this.deleteHandle(this.handle);
      if (this.handle) {
        this.removeStats();
      }
      this.#handle = null;
      if (children && deleteChildren) {
        children.filter(Boolean).forEach((child) => child.delete());
      }
      return this;
    }
    bind(funcOrHandle = this.handle) {
      throw new Error(ERR_RESOURCE_METHOD_UNDEFINED);
    }
    unbind() {
      this.bind(null);
    }
    removeStats() {
      throw new Error(ERR_RESOURCE_METHOD_UNDEFINED);
    }
    createHandle() {
      throw new Error(ERR_RESOURCE_METHOD_UNDEFINED);
    }
    deleteHandle() {
      throw new Error(ERR_RESOURCE_METHOD_UNDEFINED);
    }
    toString() {
      return `${this.constructor.name}(${this.id})`;
    }
  }

  class RenderBuffer extends Resource {
    width;
    height;
    #internalFormat;
    constructor(renderer, options = {}) {
      super(renderer, {
        ...options,
        format: options.format || renderer.gl.DEPTH_COMPONENT16
      });
      this.#internalFormat = this.options.format;
      this.width = this.options.width;
      this.height = this.options.height;
      console.assert(
        this.width > 0 && this.height > 0,
        "Renderbuffer object requires valid width and height greater than zero"
      );
      this.bind();
      renderer.gl.renderbufferStorage(
        renderer.gl.RENDERBUFFER,
        this.#internalFormat,
        this.width,
        this.height
      );
    }
    resize(width, height) {
      if (width === this.width && height === this.height)
        return;
      this.width = width;
      this.height = height;
      this.bind();
      this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.#internalFormat, width, height);
      this.unbind();
    }
    bind() {
      this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.handle);
    }
    unbind() {
      this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
    }
    removeStats() {
    }
    destroy() {
      this.unbind();
      this.deleteHandle();
    }
    createHandle() {
      return this.gl.createRenderbuffer();
    }
    deleteHandle() {
      this.handle && this.gl.deleteRenderbuffer(this.handle);
    }
  }

  const emptyPixel = new Uint8Array(4);
  class Texture extends Resource {
    needsUpdate = false;
    textureUnit = 0;
    image;
    width;
    height;
    target;
    #state = {};
    constructor(renderer, options = {}, needsUpdate = true) {
      const { gl } = renderer;
      const defaultOptions = {
        target: gl.TEXTURE_2D,
        type: gl.UNSIGNED_BYTE,
        format: gl.RGBA,
        internalFormat: options.format || gl.RGBA,
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE,
        generateMipmaps: true,
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR,
        premultiplyAlpha: false,
        unpackAlignment: 4,
        anisotropy: 0,
        flipY: false,
        level: 0
      };
      const opt = Object.assign({}, defaultOptions, options);
      super(renderer, opt);
      this.textureUnit = 0;
      this.image = this.options.image;
      this.width = this.options.width;
      this.height = this.options.height;
      this.target = this.options.target;
      this.#state.version = -1;
      this.needsUpdate = Boolean(needsUpdate);
      if (this.needsUpdate) {
        this.update();
      }
    }
    setData(image, width = this.width, height = this.height) {
      this.image = image;
      this.width = width;
      this.height = height;
      this.needsUpdate = true;
    }
    setOptions(options) {
      this.options = Object.assign(this.options, options);
      this.width = this.options.width;
      this.height = this.options.height;
      this.needsUpdate = true;
    }
    fromSrc(url) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          this.setData(image, image.width, image.height);
          resolve(this);
        };
        image.onerror = (e) => {
          reject(e);
        };
        image.crossOrigin = "*";
        image.src = url;
      });
    }
    update(units = 0) {
      const needUpdate = !(this.image === this.#state.image && !this.needsUpdate);
      const checked = needUpdate || this.rendererState.textureUnits[units] !== this.id || this.rendererState.activeTextureUnit !== units;
      if (checked) {
        this.rendererState.setActiveTexture(units);
        this.bind(units);
      }
      if (!needUpdate)
        return;
      this.needsUpdate = false;
      if (this.options.wrapS !== this.#state.wrapS) {
        this.gl.texParameteri(this.target, this.gl.TEXTURE_WRAP_S, this.options.wrapS);
        this.#state.wrapS = this.options.wrapS;
      }
      if (this.options.wrapT !== this.#state.wrapT) {
        this.gl.texParameteri(this.target, this.gl.TEXTURE_WRAP_T, this.options.wrapT);
        this.#state.wrapT = this.options.wrapT;
      }
      if (this.options.minFilter !== this.#state.minFilter) {
        this.gl.texParameteri(
          this.target,
          this.gl.TEXTURE_MIN_FILTER,
          this.options.minFilter
        );
        this.#state.minFilter = this.options.minFilter;
      }
      if (this.options.magFilter !== this.#state.magFilter) {
        this.gl.texParameteri(
          this.target,
          this.gl.TEXTURE_MAG_FILTER,
          this.options.magFilter
        );
        this.#state.magFilter = this.options.magFilter;
      }
      if (this.options.flipY !== this.rendererState.flipY) {
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, this.options.flipY);
        this.rendererState.flipY = this.options.flipY;
      }
      if (this.options.premultiplyAlpha !== this.rendererState.premultiplyAlpha) {
        this.gl.pixelStorei(
          this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
          this.options.premultiplyAlpha
        );
        this.rendererState.premultiplyAlpha = this.options.premultiplyAlpha;
      }
      if (this.options.unpackAlignment !== this.rendererState.unpackAlignment) {
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, this.options.unpackAlignment);
        this.rendererState.unpackAlignment = this.options.unpackAlignment;
      }
      if (this.options.anisotropy && this.options.anisotropy !== this.rendererState.anisotropy) {
        const extTextureFilterAnisotropic = this.gl.getExtension("EXT_texture_filter_anisotropic") || this.gl.getExtension("MOZ_EXT_texture_filter_anisotropic") || this.gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
        if (extTextureFilterAnisotropic) {
          const max = this.gl.getParameter(
            extTextureFilterAnisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT
          );
          let v = this.options.anisotropy;
          if (this.options.anisotropy > max) {
            v = max;
            console.warn(
              `[Texture]: Texture.anisotropy option exceeded the maximum allowed value ${max} of the device`
            );
          }
          this.gl.texParameterf(
            this.target,
            extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
            v
          );
        }
        this.rendererState.anisotropy = this.options.anisotropy;
      }
      if (this.image) {
        if (this.image.width) {
          this.width = this.image.width;
          this.height = this.image.height;
        }
        if (this.renderer.isWebGL2 && isNumber(this.options.offset)) {
          this.gl.texImage2D(
            this.target,
            this.options.level,
            this.options.internalFormat,
            this.width,
            this.height,
            0,
            this.options.format,
            this.options.type,
            this.image,
            this.options.offset
          );
        } else {
          if (ArrayBuffer.isView(this.image)) {
            this.gl.texImage2D(
              this.target,
              this.options.level,
              this.options.internalFormat,
              this.width,
              this.height,
              0,
              this.options.format,
              this.options.type,
              this.image
            );
          } else {
            this.gl.texImage2D(
              this.target,
              this.options.level,
              this.options.internalFormat,
              this.options.format,
              this.options.type,
              this.image
            );
          }
        }
        if (this.options.generateMipmaps) {
          if (this.renderer.isWebGL2 || isPowerOfTwo(this.image.width) && isPowerOfTwo(this.image.height)) {
            this.gl.generateMipmap(this.target);
          } else {
            this.options.generateMipmaps = false;
            this.options.wrapS = this.gl.CLAMP_TO_EDGE;
            this.options.wrapT = this.options.wrapS;
            this.options.minFilter = this.gl.LINEAR;
          }
        }
      } else {
        if (this.renderer.isWebGL2 && isNumber(this.options.offset)) {
          if (this.width > 0) {
            this.gl.texImage2D(
              this.target,
              this.options.level,
              this.options.internalFormat,
              this.width,
              this.height,
              0,
              this.options.format,
              this.options.type,
              this.options.offset
            );
          } else {
            this.gl.texImage2D(
              this.target,
              0,
              this.gl.RGBA,
              1,
              1,
              0,
              this.gl.RGBA,
              this.gl.UNSIGNED_BYTE,
              emptyPixel,
              this.options.offset
            );
          }
        } else {
          if (this.width > 0) {
            this.gl.texImage2D(
              this.target,
              this.options.level,
              this.options.internalFormat,
              this.width,
              this.height,
              0,
              this.options.format,
              this.options.type,
              null
            );
          } else {
            this.gl.texImage2D(
              this.target,
              0,
              this.gl.RGBA,
              1,
              1,
              0,
              this.gl.RGBA,
              this.gl.UNSIGNED_BYTE,
              emptyPixel
            );
          }
        }
      }
      this.#state.image = this.image;
      this.#state.version += 1;
    }
    bind(unit = this.textureUnit) {
      if (this.rendererState.textureUnits[this.rendererState.activeTextureUnit] === this.id)
        return;
      this.textureUnit = unit;
      this.rendererState.textureUnits[this.textureUnit] = this.id;
      this.gl.bindTexture(this.target, this.handle);
    }
    unbind() {
      this.gl.activeTexture(this.gl.TEXTURE0 + this.textureUnit);
      this.gl.bindTexture(this.target, null);
      delete this.rendererState.textureUnits[this.textureUnit];
    }
    destroy() {
      this.unbind();
      super.destroy();
    }
    removeStats() {
      this.#state = {
        version: -1
      };
    }
    createHandle() {
      return this.gl.createTexture();
    }
    deleteHandle() {
      if (this.handle) {
        this.gl.deleteTexture(this.handle);
      }
    }
    toString() {
      return `Texture(${this.id},${this.width}x${this.height})`;
    }
  }

  class DataTexture extends Texture {
    needsUpdate = true;
    constructor(renderer, options = {}) {
      super(renderer, {
        ...options,
        image: options.data,
        premultiplyAlpha: true,
        flipY: false,
        unpackAlignment: 1
      });
    }
  }

  class RenderTarget extends Resource {
    #textures;
    #renderBuffers;
    depth;
    width;
    height;
    viewport;
    drawBuffersChanged;
    drawBuffers;
    #clearColors;
    #clearDepth;
    #clearStencil;
    constructor(renderer, options = {}) {
      super(renderer, {
        color: 1,
        depth: true,
        depthTexture: false,
        stencil: false,
        ...options
      });
      this.#renderBuffers = /* @__PURE__ */ new Map();
      this.#textures = /* @__PURE__ */ new Map();
      this.depth = Boolean(options.depth);
      this.drawBuffers = [];
      this.drawBuffersChanged = false;
      this.width = this.options.width;
      this.height = this.options.height;
      this.viewport = new Vector4(0, 0, this.width, this.height);
      this.name = this.options.name;
      const attachments = this.options.attachments || [];
      if (attachments.length === 0) {
        for (let i = 0; i < this.options.color; i++) {
          const opt = {
            wrapS: this.gl.CLAMP_TO_EDGE,
            wrapT: this.gl.CLAMP_TO_EDGE,
            minFilter: this.gl.LINEAR,
            magFilter: this.gl.LINEAR,
            type: this.gl.UNSIGNED_BYTE,
            format: this.gl.RGBA,
            flipY: false,
            generateMipmaps: false,
            ...options
          };
          let texture;
          if (opt.data) {
            texture = new DataTexture(renderer, opt);
          } else {
            texture = new Texture(
              renderer,
              omit(opt, [
                "data",
                "name",
                "attachments",
                "depthTexture"
              ])
            );
          }
          attachments.push([this.gl.COLOR_ATTACHMENT0 + i, texture]);
        }
        if (options.depthTexture && (renderer.isWebGL2 || !renderer.isWebGL2 && renderer.gl.getExtension("WEBGL_depth_texture"))) {
          const texture = new Texture(renderer, {
            width: this.width,
            height: this.height,
            minFilter: this.gl.NEAREST,
            magFilter: this.gl.NEAREST,
            format: this.gl.DEPTH_COMPONENT,
            internalFormat: renderer.isWebGL2 ? this.gl.DEPTH_COMPONENT16 : this.gl.DEPTH_COMPONENT,
            type: this.gl.UNSIGNED_INT
          });
          attachments.push([this.gl.DEPTH_ATTACHMENT, texture]);
        } else {
          const { depth, stencil } = options;
          if (depth && !stencil) {
            const renderBuffer = new RenderBuffer(renderer, {
              format: this.gl.DEPTH_COMPONENT16,
              width: this.width,
              height: this.height
            });
            attachments.push([this.gl.DEPTH_ATTACHMENT, renderBuffer]);
          } else if (stencil && !depth) {
            const renderBuffer = new RenderBuffer(renderer, {
              format: this.gl.STENCIL_INDEX8,
              width: this.width,
              height: this.height
            });
            attachments.push([this.gl.STENCIL_ATTACHMENT, renderBuffer]);
          } else if (depth && stencil) {
            const renderBuffer = new RenderBuffer(renderer, {
              format: this.gl.DEPTH_STENCIL,
              width: this.width,
              height: this.height
            });
            attachments.push([this.gl.DEPTH_STENCIL_ATTACHMENT, renderBuffer]);
          }
        }
      }
      this.create(attachments);
    }
    get texture() {
      return this.#textures.values().next().value;
    }
    set clearColors(colors) {
      this.#clearColors = colors;
    }
    get clearColors() {
      return this.#clearColors;
    }
    set clearDepth(depth) {
      this.#clearDepth = depth;
    }
    get clearDepth() {
      return this.#clearDepth;
    }
    set clearStencil(stencil) {
      this.#clearStencil = stencil;
    }
    get clearStencil() {
      return this.#clearStencil;
    }
    create(attachments) {
      this.#clearColors = [];
      this.#clearDepth = 1;
      this.#clearStencil = 0;
      for (const attachment of attachments) {
        const attach = attachment[0];
        const target = attachment[1];
        if (target instanceof RenderBuffer) {
          this.#renderBuffers.set(attach, target);
        } else if (target instanceof Texture) {
          this.#textures.set(attach, target);
          this.drawBuffers.push(attach);
        }
        const i = attach - this.gl.COLOR_ATTACHMENT0;
        this.#clearColors[i] = [0, 0, 0, 0];
      }
      if (this.options.color > 1) {
        if (this.renderer.isWebGL2) {
          this.gl.drawBuffers(this.drawBuffers);
        } else {
          const ext = this.renderer.extension("WEBGL_draw_buffers");
          if (ext && ext.drawBuffersWEBGL) {
            ext.drawBuffersWEBGL(this.drawBuffers);
          } else {
            throw new Error(
              "Please open the corresponding extension [WEBGL_draw_buffers](https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_draw_buffers#browser_compatibility) and check whether the browser supports it"
            );
          }
        }
      }
      this.drawBuffersChanged = true;
      this.bind();
      this.#renderBuffers.forEach((rbo, attachment) => {
        this.gl.framebufferRenderbuffer(
          this.gl.FRAMEBUFFER,
          attachment,
          this.gl.RENDERBUFFER,
          rbo.handle
        );
      });
      this.#textures.forEach((texture, attachment) => {
        this.gl.framebufferTexture2D(
          this.gl.FRAMEBUFFER,
          attachment,
          this.gl.TEXTURE_2D,
          texture.handle,
          0
        );
      });
      this.unbind();
      const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
      if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
        switch (status) {
          case this.gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
            throw new Error(
              "The attachment types are mismatched or not all framebuffer attachment points are framebuffer attachment complete"
            );
          case this.gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
            throw new Error("There is no attachment");
          case this.gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
            throw new Error(" Height and width of the attachment are not the same.");
          case this.gl.FRAMEBUFFER_UNSUPPORTED:
            throw new Error(
              "The format of the attachment is not supported or if depth and stencil attachments are not the same renderbuffer"
            );
        }
      }
      return this.handle;
    }
    clear() {
      this.bind();
      let flags = 0;
      if (this.clearColors[0]) {
        const color = this.clearColors[0];
        this.gl.clearColor(color[0], color[1], color[2], color[3]);
        flags |= this.gl.COLOR_BUFFER_BIT;
      }
      if (isNumber(this.#clearDepth)) {
        this.gl.clearDepth(this.#clearDepth);
        flags |= this.gl.DEPTH_BUFFER_BIT;
      }
      if (isNumber(this.#clearStencil)) {
        this.gl.clearStencil(this.#clearStencil);
        flags |= this.gl.STENCIL_BUFFER_BIT;
      }
      this.gl.clear(flags);
      this.unbind();
    }
    getTexture(key) {
      return this.#textures.get(key);
    }
    resize(width, height) {
      if (this.width !== width || this.height !== height) {
        this.width = width;
        this.height = height;
        this.#textures.forEach((texture) => {
          if (texture.width !== width || texture.height !== height) {
            texture.width = width;
            texture.height = height;
            texture.needsUpdate = true;
            texture.update();
          }
        });
        this.#renderBuffers.forEach((rbo) => {
          rbo.resize(width, height);
        });
        this.viewport.set(0, 0, width, height);
      }
    }
    bind(fbo = this.gl.FRAMEBUFFER) {
      this.gl.bindFramebuffer(fbo, this.handle);
    }
    unbind(fbo = this.gl.FRAMEBUFFER) {
      this.gl.bindFramebuffer(fbo, null);
    }
    removeStats() {
    }
    destroy() {
      this.#textures.forEach((texture) => {
        texture.destroy();
      });
      this.#renderBuffers.forEach((buffer) => {
        buffer.destroy();
      });
      this.deleteHandle();
    }
    createHandle() {
      return this.gl.createFramebuffer();
    }
    deleteHandle() {
      this.handle && this.gl.deleteFramebuffer(this.handle);
    }
    toString() {
      return `RenderTarget(${this.id},${this.width}x${this.height})`;
    }
  }

  const ERR_SOURCE = "Shader: GLSL source code must be a JavaScript string";
  const cachedIds = {};
  function genShaderName(key = "id") {
    cachedIds[key] = cachedIds[key] || 1;
    const idx = cachedIds[key];
    cachedIds[key] += 1;
    return "".concat(key, "-").concat(idx);
  }
  const getTypeName = (ctx, shaderType) => {
    switch (shaderType) {
      case ctx.VERTEX_SHADER:
        return "vertex-shader";
      case ctx.FRAGMENT_SHADER:
        return "fragment-shader";
      default:
        return "unknown";
    }
  };
  const getShaderType = (ctx, type) => {
    switch (type) {
      case "fragment":
        return ctx.FRAGMENT_SHADER;
      case "vertex":
        return ctx.VERTEX_SHADER;
      default:
        return;
    }
  };
  function addLineNumbers(string) {
    const lines = string.split("\n");
    for (let i = 0; i < lines.length; i++) {
      lines[i] = i + 1 + ": " + lines[i];
    }
    return lines.join("\n");
  }
  class Shader extends Resource {
    #shaderType;
    #includes;
    sourceCode;
    constructor(renderer, sourceCode, type, includes = {}) {
      const shaderType = getShaderType(renderer.gl, type);
      super(renderer, {
        name: getShaderName(sourceCode) || genShaderName(getTypeName(renderer, shaderType))
      });
      console.assert(typeof sourceCode === "string", ERR_SOURCE);
      this.#includes = includes;
      this.#shaderType = shaderType;
      this.sourceCode = this.injectShaderModule(sourceCode, includes || {}).replace(
        /\n\n+/gm,
        "\n\n"
      );
      this.createShader(this.sourceCode);
    }
    injectShaderModule(shader, modules = {}) {
      const regExp = /^[\t ]*#glsl_include +<([\w.]+)>/gm;
      const replacement = (substring, r) => {
        let module = modules[r];
        if (module === void 0)
          throw new Error("Cannot resolve #include <".concat(r, ">"));
        module = module.replace(/#include </g, "#glsl_include <");
        return this.injectShaderModule(module, modules);
      };
      return shader.replace(regExp, replacement);
    }
    createShader(source = this.source) {
      let s = source.replace(/#include </g, "#glsl_include <");
      s = this.injectShaderModule(s, this.#includes || {}).replace(/\n\n+/gm, "\n\n");
      this.gl.shaderSource(this.handle, s);
      this.gl.compileShader(this.handle);
      if (!this.gl.getShaderParameter(this.handle, this.gl.COMPILE_STATUS)) {
        const log = this.gl.getShaderInfoLog(this.handle) || "";
        this.gl.deleteShader(this.handle);
        throw new Error(`${this.toString()}
${log}
${addLineNumbers(s)}`);
      }
    }
    get source() {
      return this.sourceCode;
    }
    get shaderType() {
      return this.#shaderType;
    }
    getSource() {
      return this.gl.getShaderSource(this.handle);
    }
    setSource(source) {
      const name = getShaderName(source);
      if (name) {
        this.name = genShaderName(name);
      }
      this.createShader(source);
    }
    removeStats() {
    }
    deleteHandle() {
      this.gl.deleteShader(this.handle);
    }
    toString() {
      return `${getTypeName(this.gl, this.shaderType)}:${this.id}`;
    }
  }
  class VertexShader extends Shader {
    constructor(renderer, sourceCode, includes) {
      super(renderer, sourceCode, "vertex", includes);
    }
    createHandle() {
      return this.gl.createShader(this.gl.VERTEX_SHADER);
    }
  }
  class FragmentShader extends Shader {
    constructor(renderer, sourceCode, includes) {
      super(renderer, sourceCode, "fragment", includes);
    }
    createHandle() {
      return this.gl.createShader(this.gl.FRAGMENT_SHADER);
    }
  }

  const getDefines = (t) => {
    const defines = [];
    return defines.map((d) => "#define ".concat(d));
  };
  const arrayCacheF32 = {};
  function flatten(a) {
    const arrayLen = a.length;
    const valueLen = a[0].length;
    if (valueLen === void 0)
      return a;
    const length = arrayLen * valueLen;
    let value = arrayCacheF32[length];
    if (!value)
      arrayCacheF32[length] = value = new Float32Array(length);
    for (let i = 0; i < arrayLen; i++)
      value.set(a[i], i * valueLen);
    return value;
  }
  function setUniform(gl, type, location, value) {
    value = value.length ? flatten(value) : value;
    const isArray = value.length;
    switch (type) {
      case WebGLRenderingContext.FLOAT:
        return isArray ? gl.uniform1fv(location, value) : gl.uniform1f(location, value);
      case WebGLRenderingContext.FLOAT_VEC2:
        return gl.uniform2fv(location, value);
      case WebGLRenderingContext.FLOAT_VEC3:
        return gl.uniform3fv(location, value);
      case WebGLRenderingContext.FLOAT_VEC4:
        return gl.uniform4fv(location, value);
      case WebGLRenderingContext.BOOL:
      case WebGLRenderingContext.INT:
      case WebGLRenderingContext.SAMPLER_2D:
      case WebGLRenderingContext.SAMPLER_CUBE:
        return isArray ? gl.uniform1iv(location, value) : gl.uniform1i(location, value);
      case WebGLRenderingContext.BOOL_VEC2:
      case WebGLRenderingContext.INT_VEC2:
        return gl.uniform2iv(location, value);
      case WebGLRenderingContext.BOOL_VEC3:
      case WebGLRenderingContext.INT_VEC3:
        return gl.uniform3iv(location, value);
      case WebGLRenderingContext.BOOL_VEC4:
      case WebGLRenderingContext.INT_VEC4:
        return gl.uniform4iv(location, value);
      case WebGLRenderingContext.FLOAT_MAT2:
        return gl.uniformMatrix2fv(location, false, value);
      case WebGLRenderingContext.FLOAT_MAT3:
        return gl.uniformMatrix3fv(location, false, value);
      case WebGLRenderingContext.FLOAT_MAT4:
        return gl.uniformMatrix4fv(location, false, value);
    }
  }
  class Program extends Resource {
    attributeOrder;
    uniforms;
    #uniformLocations;
    #attributeLocations;
    #vs;
    #fs;
    #renderState;
    constructor(renderer, options = {}) {
      super(renderer, options);
      const {
        id,
        vertexShader,
        fragmentShader,
        uniforms = {},
        transparent = false,
        defines = [],
        includes = {},
        cullFace,
        frontFace = renderer.gl.CCW,
        depthTest = true,
        depthWrite = true,
        depthFunc = renderer.gl.LESS,
        blending = 1,
        blendFunc,
        blendEquation
      } = options;
      this.id = id || uid("program");
      const defs = [
        ...getDefines({
          ...options,
          ...uniforms
        }),
        ...defines
      ].map((str) => !str.startsWith("#define ") ? "#define ".concat(str) : str);
      if (!vertexShader || !fragmentShader) {
        throw new Error(`Program: ${this.id}\uFF1Amust provide vertexShader and fragmentShader`);
      }
      this.#vs = typeof vertexShader === "string" ? new VertexShader(renderer, parseShader(vertexShader, defs), includes) : vertexShader;
      this.#fs = typeof fragmentShader === "string" ? new FragmentShader(renderer, parseShader(fragmentShader, defs), includes) : fragmentShader;
      this.gl.attachShader(this.handle, this.#vs.handle);
      this.gl.attachShader(this.handle, this.#fs.handle);
      this.gl.linkProgram(this.handle);
      this.gl.validateProgram(this.handle);
      if (!this.gl.getProgramParameter(this.handle, this.gl.LINK_STATUS)) {
        throw new Error(
          "Program:".concat(this.id, ": Error linking ").concat(this.gl.getProgramInfoLog(this.handle))
        );
      }
      this.uniforms = uniforms;
      this.#renderState = {
        blending,
        cullFace,
        frontFace,
        depthTest,
        depthWrite,
        depthFunc,
        blendFunc,
        blendEquation
      };
      this.#uniformLocations = /* @__PURE__ */ new Map();
      this.#attributeLocations = /* @__PURE__ */ new Map();
      this.#assignUniforms(uniforms);
      this.#assignAttributes();
      if (transparent && !blendFunc?.src) {
        if (this.renderer.premultipliedAlpha) {
          this.#renderState.blendFunc = {
            ...blendFunc,
            src: this.gl.ONE,
            dst: this.gl.ONE_MINUS_SRC_ALPHA
          };
        } else {
          this.#renderState.blendFunc = {
            ...blendFunc,
            src: this.gl.SRC_ALPHA,
            dst: this.gl.ONE_MINUS_SRC_ALPHA
          };
        }
      }
    }
    get uniformLocations() {
      return this.#uniformLocations;
    }
    get attributeLocations() {
      return this.#attributeLocations;
    }
    get vertexShader() {
      return this.#vs;
    }
    get fragmentShader() {
      return this.#fs;
    }
    use() {
      const programActive = this.rendererState.currentProgramId === this.id;
      let textureUnit = -1;
      if (!programActive) {
        this.gl.useProgram(this.handle);
        this.rendererState.currentProgramId = this.id;
      }
      this.#uniformLocations.forEach((location, activeUniform) => {
        const name = activeUniform.name;
        const uniform = this.uniforms[name];
        if (!uniform) {
          console.warn("Program:".concat(this.id, ": Active uniform ").concat(name, " has not been supplied"));
          return;
        }
        if (uniform && (isUndef(uniform.value) || isNull(uniform.value))) {
          console.warn("Program:".concat(this.id, ": Uniform ").concat(name, " is missing a value parameter"));
          return;
        }
        let value = uniform?.value;
        if (value instanceof Texture) {
          textureUnit += 1;
          uniform.value.update(textureUnit);
          return setUniform(this.gl, activeUniform.type, location.location, textureUnit);
        }
        if (value instanceof Matrix || value instanceof Vector) {
          value = uniform.value.toArray();
        } else if (value instanceof Color) {
          value = uniform.value.toArray();
        }
        if (value && value.length > 0 && value[0] instanceof Texture) {
          const units = [];
          for (let i = 0; i < uniform.value.length; i++) {
            const v = value[i];
            textureUnit += 1;
            v.update(textureUnit);
            units.push(textureUnit);
          }
          return setUniform(this.gl, activeUniform.type, location.location, units);
        }
        setUniform(this.gl, activeUniform.type, location.location, value);
      });
      this.applyState();
    }
    setStates(states, merge = true) {
      if (!merge) {
        this.#renderState = states;
      } else {
        this.#renderState = {
          ...this.#renderState,
          ...omit(states, ["blendFunc", "blendEquation"])
        };
        if (states.blendFunc) {
          this.#renderState.blendFunc = {
            ...this.#renderState.blendFunc,
            ...states.blendFunc
          };
        }
        if (states.blendEquation) {
          this.#renderState.blendEquation = {
            ...this.#renderState.blendEquation,
            ...states.blendEquation
          };
        }
      }
    }
    applyState() {
      this.rendererState.apply(this.#renderState);
    }
    setUniform(key, value) {
      if (this.uniforms[key]) {
        this.uniforms[key].value = value;
      }
    }
    bind() {
      this.gl.useProgram(this.handle);
    }
    unbind() {
      this.gl.useProgram(null);
    }
    createHandle() {
      return this.gl.createProgram();
    }
    deleteHandle() {
      this.gl.deleteProgram(this.handle);
    }
    #assignUniforms(uniforms = {}) {
      const numUniforms = this.gl.getProgramParameter(this.handle, this.gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < numUniforms; i++) {
        const uniformInfo = this.gl.getActiveUniform(this.handle, i);
        if (!uniformInfo)
          break;
        const name = uniformInfo.name;
        const split = name.match(/(\w+)/g);
        const uniformData = {
          location: this.gl.getUniformLocation(this.handle, name),
          type: uniformInfo.type,
          name: split[0],
          isStruct: false
        };
        if (split.length === 3) {
          uniformData.isStructArray = true;
          uniformData.structIndex = Number(split[1]);
          uniformData.structProperty = split[2];
        } else if (split.length === 2 && isNaN(Number(split[1]))) {
          uniformData.isStruct = true;
          uniformData.structProperty = split[1];
        }
        const v = uniforms[name]?.value;
        if (!isUndef(v) && !isNull(v)) {
          uniformData.value = uniforms[name].value;
        }
        this.uniforms[name] = uniformData;
        this.#uniformLocations.set(uniformInfo, uniformData);
      }
    }
    #assignAttributes() {
      const numAttribs = this.gl.getProgramParameter(this.handle, this.gl.ACTIVE_ATTRIBUTES);
      const locations = [];
      for (let i = 0; i < numAttribs; i++) {
        const attribInfo = this.gl.getActiveAttrib(this.handle, i);
        if (!attribInfo)
          break;
        const location = this.gl.getAttribLocation(this.handle, attribInfo.name);
        locations[location] = attribInfo.name;
        this.#attributeLocations.set(attribInfo, location);
      }
      this.attributeOrder = locations.join("");
    }
    destroy() {
      this.unbind();
      this.deleteHandle();
    }
  }

  const tempMat4 = new Matrix4();
  const tempVec3a = new Vector3();
  const tempVec3b = new Vector3();
  const ERR_CAMERA_METHOD_UNDEFINED = "Camera subclass must define virtual methods";
  class Camera extends Object3D {
    cameraType;
    projectionMatrix;
    viewMatrix;
    projectionViewMatrix;
    worldPosition;
    #near;
    #far;
    #fov;
    #aspect;
    #zoom;
    #bounds;
    frustum;
    constructor({
      near = 0.1,
      far = 100,
      fov = 45,
      aspect = 1,
      bounds,
      zoom = 1
    } = {}) {
      super();
      this.cameraType = "perspective";
      this.projectionMatrix = new ProjectionMatrix();
      this.viewMatrix = new Matrix4();
      this.projectionViewMatrix = new ProjectionMatrix();
      this.worldPosition = new Vector3();
      this.frustum = new Matrix4();
      this.#near = near;
      this.#far = far;
      this.#fov = fov;
      this.#aspect = aspect;
      this.#bounds = bounds;
      this.#zoom = zoom;
      const {
        left,
        right,
        top,
        bottom
      } = bounds || {};
      this.cameraType = left || right ? "orthographic" : "perspective";
      if (this.cameraType === "orthographic") {
        this.orthographic(left, right, top, bottom, near, far, zoom);
      } else {
        this.perspective(fov, aspect, near, far);
      }
    }
    get near() {
      return this.#near;
    }
    set near(n) {
      this.#near = n;
      this.updateProjectionMatrix();
    }
    get far() {
      return this.#far;
    }
    set far(f) {
      this.#far = f;
      this.updateProjectionMatrix();
    }
    get fov() {
      return this.#fov;
    }
    set fov(f) {
      this.#fov = f;
      this.updateProjectionMatrix();
    }
    get aspect() {
      return this.#aspect;
    }
    set aspect(aspect) {
      this.#aspect = aspect;
      this.updateProjectionMatrix();
    }
    get zoom() {
      return this.#zoom;
    }
    set zoom(zoom) {
      this.#zoom = zoom;
      this.updateProjectionMatrix();
    }
    get bounds() {
      return this.#bounds;
    }
    set bounds(bounds) {
      this.#bounds = bounds;
      this.updateProjectionMatrix();
    }
    perspective(fov = this.fov, aspect = this.aspect, near = this.near, far = this.far) {
      this.#fov = fov;
      this.#aspect = aspect;
      this.#near = near;
      this.#far = far;
      this.projectionMatrix.fromPerspective(fov, aspect, near, far);
      this.cameraType = "perspective";
    }
    orthographic(left, right, top, bottom, near = this.near, far = this.far, zoom = 1) {
      this.#bounds = {
        left,
        right,
        top,
        bottom
      };
      this.near = near;
      this.far = far;
      this.projectionMatrix.orthographic(
        left / zoom,
        right / zoom,
        top / zoom,
        bottom / zoom,
        near,
        far
      );
      this.cameraType = "orthographic";
      this.projectionMatrix.frustum(this.frustum, this.#bounds.left, this.#bounds.right, this.#bounds.top, this.#bounds.bottom, this.#near, this.#far);
    }
    lookAt(t) {
      super.lookAt(t, true);
      return this;
    }
    updateMatrixWorld() {
      super.updateMatrixWorld();
      this.viewMatrix.invert(this.worldMatrix);
      this.worldMatrix.getTranslation(this.worldPosition);
      this.projectionViewMatrix.multiply(this.projectionMatrix, this.viewMatrix);
      return this;
    }
    frustumIntersectsMesh(node, worldMatrix = node.worldMatrix) {
      if (!node.geometry.attributes.position)
        return true;
      if (!node.geometry.bounds || node.geometry.bounds.radius === Infinity)
        node.geometry.computeBoundingSphere();
      if (!node.geometry.bounds)
        return true;
      const center = tempVec3a;
      center.copy(node.geometry.bounds.center);
      center.applyMatrix4(worldMatrix);
      const radius = node.geometry.bounds.radius * worldMatrix.getMaxScaleOnAxis();
      return this.frustumIntersectsSphere(center, radius);
    }
    frustumIntersectsSphere(center, radius) {
      const normal = tempVec3b;
      for (let i = 0; i < 6; i++) {
        const plane = this.frustum[i];
        const distance = normal.copy(plane).dot(center) + plane.constant;
        if (distance < -radius)
          return false;
      }
      return true;
    }
    project(v) {
      v.applyMatrix4(this.viewMatrix);
      v.applyMatrix4(this.projectionMatrix);
      return this;
    }
    unproject(v) {
      v.applyMatrix4(tempMat4.invert(this.projectionMatrix));
      v.applyMatrix4(this.worldMatrix);
      return this;
    }
    updateProjectionMatrix() {
      throw new Error(ERR_CAMERA_METHOD_UNDEFINED);
    }
  }

  class PerspectiveCamera extends Camera {
    constructor(fov, aspect, near, far) {
      super({
        fov,
        aspect,
        near,
        far
      });
    }
    updateProjectionMatrix() {
      this.projectionMatrix.fromPerspective(this.fov, this.aspect, this.near, this.far);
    }
  }

  class OrthographicCamera extends Camera {
    constructor(left, right, top, bottom, near, far, zoom = 1) {
      super({
        bounds: {
          left,
          right,
          top,
          bottom
        },
        near,
        far,
        zoom
      });
    }
    updateProjectionMatrix() {
      const {
        left,
        right,
        top,
        bottom
      } = this.bounds;
      const { zoom } = this;
      this.projectionMatrix.orthographic(
        left / zoom,
        right / zoom,
        top / zoom,
        bottom / zoom,
        this.near,
        this.far
      );
    }
  }

  function getDefaultExportFromCjs (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  var earcut$2 = {exports: {}};

  earcut$2.exports = earcut;
  earcut$2.exports.default = earcut;

  function earcut(data, holeIndices, dim) {

      dim = dim || 2;

      var hasHoles = holeIndices && holeIndices.length,
          outerLen = hasHoles ? holeIndices[0] * dim : data.length,
          outerNode = linkedList(data, 0, outerLen, dim, true),
          triangles = [];

      if (!outerNode || outerNode.next === outerNode.prev) return triangles;

      var minX, minY, maxX, maxY, x, y, invSize;

      if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);

      // if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
      if (data.length > 80 * dim) {
          minX = maxX = data[0];
          minY = maxY = data[1];

          for (var i = dim; i < outerLen; i += dim) {
              x = data[i];
              y = data[i + 1];
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
          }

          // minX, minY and invSize are later used to transform coords into integers for z-order calculation
          invSize = Math.max(maxX - minX, maxY - minY);
          invSize = invSize !== 0 ? 32767 / invSize : 0;
      }

      earcutLinked(outerNode, triangles, dim, minX, minY, invSize, 0);

      return triangles;
  }

  // create a circular doubly linked list from polygon points in the specified winding order
  function linkedList(data, start, end, dim, clockwise) {
      var i, last;

      if (clockwise === (signedArea(data, start, end, dim) > 0)) {
          for (i = start; i < end; i += dim) last = insertNode(i, data[i], data[i + 1], last);
      } else {
          for (i = end - dim; i >= start; i -= dim) last = insertNode(i, data[i], data[i + 1], last);
      }

      if (last && equals(last, last.next)) {
          removeNode(last);
          last = last.next;
      }

      return last;
  }

  // eliminate colinear or duplicate points
  function filterPoints(start, end) {
      if (!start) return start;
      if (!end) end = start;

      var p = start,
          again;
      do {
          again = false;

          if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
              removeNode(p);
              p = end = p.prev;
              if (p === p.next) break;
              again = true;

          } else {
              p = p.next;
          }
      } while (again || p !== end);

      return end;
  }

  // main ear slicing loop which triangulates a polygon (given as a linked list)
  function earcutLinked(ear, triangles, dim, minX, minY, invSize, pass) {
      if (!ear) return;

      // interlink polygon nodes in z-order
      if (!pass && invSize) indexCurve(ear, minX, minY, invSize);

      var stop = ear,
          prev, next;

      // iterate through ears, slicing them one by one
      while (ear.prev !== ear.next) {
          prev = ear.prev;
          next = ear.next;

          if (invSize ? isEarHashed(ear, minX, minY, invSize) : isEar(ear)) {
              // cut off the triangle
              triangles.push(prev.i / dim | 0);
              triangles.push(ear.i / dim | 0);
              triangles.push(next.i / dim | 0);

              removeNode(ear);

              // skipping the next vertex leads to less sliver triangles
              ear = next.next;
              stop = next.next;

              continue;
          }

          ear = next;

          // if we looped through the whole remaining polygon and can't find any more ears
          if (ear === stop) {
              // try filtering points and slicing again
              if (!pass) {
                  earcutLinked(filterPoints(ear), triangles, dim, minX, minY, invSize, 1);

              // if this didn't work, try curing all small self-intersections locally
              } else if (pass === 1) {
                  ear = cureLocalIntersections(filterPoints(ear), triangles, dim);
                  earcutLinked(ear, triangles, dim, minX, minY, invSize, 2);

              // as a last resort, try splitting the remaining polygon into two
              } else if (pass === 2) {
                  splitEarcut(ear, triangles, dim, minX, minY, invSize);
              }

              break;
          }
      }
  }

  // check whether a polygon node forms a valid ear with adjacent nodes
  function isEar(ear) {
      var a = ear.prev,
          b = ear,
          c = ear.next;

      if (area(a, b, c) >= 0) return false; // reflex, can't be an ear

      // now make sure we don't have other points inside the potential ear
      var ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;

      // triangle bbox; min & max are calculated like this for speed
      var x0 = ax < bx ? (ax < cx ? ax : cx) : (bx < cx ? bx : cx),
          y0 = ay < by ? (ay < cy ? ay : cy) : (by < cy ? by : cy),
          x1 = ax > bx ? (ax > cx ? ax : cx) : (bx > cx ? bx : cx),
          y1 = ay > by ? (ay > cy ? ay : cy) : (by > cy ? by : cy);

      var p = c.next;
      while (p !== a) {
          if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 &&
              pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) &&
              area(p.prev, p, p.next) >= 0) return false;
          p = p.next;
      }

      return true;
  }

  function isEarHashed(ear, minX, minY, invSize) {
      var a = ear.prev,
          b = ear,
          c = ear.next;

      if (area(a, b, c) >= 0) return false; // reflex, can't be an ear

      var ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;

      // triangle bbox; min & max are calculated like this for speed
      var x0 = ax < bx ? (ax < cx ? ax : cx) : (bx < cx ? bx : cx),
          y0 = ay < by ? (ay < cy ? ay : cy) : (by < cy ? by : cy),
          x1 = ax > bx ? (ax > cx ? ax : cx) : (bx > cx ? bx : cx),
          y1 = ay > by ? (ay > cy ? ay : cy) : (by > cy ? by : cy);

      // z-order range for the current triangle bbox;
      var minZ = zOrder(x0, y0, minX, minY, invSize),
          maxZ = zOrder(x1, y1, minX, minY, invSize);

      var p = ear.prevZ,
          n = ear.nextZ;

      // look for points inside the triangle in both directions
      while (p && p.z >= minZ && n && n.z <= maxZ) {
          if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== a && p !== c &&
              pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
          p = p.prevZ;

          if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== a && n !== c &&
              pointInTriangle(ax, ay, bx, by, cx, cy, n.x, n.y) && area(n.prev, n, n.next) >= 0) return false;
          n = n.nextZ;
      }

      // look for remaining points in decreasing z-order
      while (p && p.z >= minZ) {
          if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== a && p !== c &&
              pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
          p = p.prevZ;
      }

      // look for remaining points in increasing z-order
      while (n && n.z <= maxZ) {
          if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== a && n !== c &&
              pointInTriangle(ax, ay, bx, by, cx, cy, n.x, n.y) && area(n.prev, n, n.next) >= 0) return false;
          n = n.nextZ;
      }

      return true;
  }

  // go through all polygon nodes and cure small local self-intersections
  function cureLocalIntersections(start, triangles, dim) {
      var p = start;
      do {
          var a = p.prev,
              b = p.next.next;

          if (!equals(a, b) && intersects$1(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {

              triangles.push(a.i / dim | 0);
              triangles.push(p.i / dim | 0);
              triangles.push(b.i / dim | 0);

              // remove two nodes involved
              removeNode(p);
              removeNode(p.next);

              p = start = b;
          }
          p = p.next;
      } while (p !== start);

      return filterPoints(p);
  }

  // try splitting polygon into two and triangulate them independently
  function splitEarcut(start, triangles, dim, minX, minY, invSize) {
      // look for a valid diagonal that divides the polygon into two
      var a = start;
      do {
          var b = a.next.next;
          while (b !== a.prev) {
              if (a.i !== b.i && isValidDiagonal(a, b)) {
                  // split the polygon in two by the diagonal
                  var c = splitPolygon(a, b);

                  // filter colinear points around the cuts
                  a = filterPoints(a, a.next);
                  c = filterPoints(c, c.next);

                  // run earcut on each half
                  earcutLinked(a, triangles, dim, minX, minY, invSize, 0);
                  earcutLinked(c, triangles, dim, minX, minY, invSize, 0);
                  return;
              }
              b = b.next;
          }
          a = a.next;
      } while (a !== start);
  }

  // link every hole into the outer loop, producing a single-ring polygon without holes
  function eliminateHoles(data, holeIndices, outerNode, dim) {
      var queue = [],
          i, len, start, end, list;

      for (i = 0, len = holeIndices.length; i < len; i++) {
          start = holeIndices[i] * dim;
          end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
          list = linkedList(data, start, end, dim, false);
          if (list === list.next) list.steiner = true;
          queue.push(getLeftmost(list));
      }

      queue.sort(compareX);

      // process holes from left to right
      for (i = 0; i < queue.length; i++) {
          outerNode = eliminateHole(queue[i], outerNode);
      }

      return outerNode;
  }

  function compareX(a, b) {
      return a.x - b.x;
  }

  // find a bridge between vertices that connects hole with an outer ring and and link it
  function eliminateHole(hole, outerNode) {
      var bridge = findHoleBridge(hole, outerNode);
      if (!bridge) {
          return outerNode;
      }

      var bridgeReverse = splitPolygon(bridge, hole);

      // filter collinear points around the cuts
      filterPoints(bridgeReverse, bridgeReverse.next);
      return filterPoints(bridge, bridge.next);
  }

  // David Eberly's algorithm for finding a bridge between hole and outer polygon
  function findHoleBridge(hole, outerNode) {
      var p = outerNode,
          hx = hole.x,
          hy = hole.y,
          qx = -Infinity,
          m;

      // find a segment intersected by a ray from the hole's leftmost point to the left;
      // segment's endpoint with lesser x will be potential connection point
      do {
          if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
              var x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
              if (x <= hx && x > qx) {
                  qx = x;
                  m = p.x < p.next.x ? p : p.next;
                  if (x === hx) return m; // hole touches outer segment; pick leftmost endpoint
              }
          }
          p = p.next;
      } while (p !== outerNode);

      if (!m) return null;

      // look for points inside the triangle of hole point, segment intersection and endpoint;
      // if there are no points found, we have a valid connection;
      // otherwise choose the point of the minimum angle with the ray as connection point

      var stop = m,
          mx = m.x,
          my = m.y,
          tanMin = Infinity,
          tan;

      p = m;

      do {
          if (hx >= p.x && p.x >= mx && hx !== p.x &&
                  pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {

              tan = Math.abs(hy - p.y) / (hx - p.x); // tangential

              if (locallyInside(p, hole) &&
                  (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) {
                  m = p;
                  tanMin = tan;
              }
          }

          p = p.next;
      } while (p !== stop);

      return m;
  }

  // whether sector in vertex m contains sector in vertex p in the same coordinates
  function sectorContainsSector(m, p) {
      return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0;
  }

  // interlink polygon nodes in z-order
  function indexCurve(start, minX, minY, invSize) {
      var p = start;
      do {
          if (p.z === 0) p.z = zOrder(p.x, p.y, minX, minY, invSize);
          p.prevZ = p.prev;
          p.nextZ = p.next;
          p = p.next;
      } while (p !== start);

      p.prevZ.nextZ = null;
      p.prevZ = null;

      sortLinked(p);
  }

  // Simon Tatham's linked list merge sort algorithm
  // http://www.chiark.greenend.org.uk/~sgtatham/algorithms/listsort.html
  function sortLinked(list) {
      var i, p, q, e, tail, numMerges, pSize, qSize,
          inSize = 1;

      do {
          p = list;
          list = null;
          tail = null;
          numMerges = 0;

          while (p) {
              numMerges++;
              q = p;
              pSize = 0;
              for (i = 0; i < inSize; i++) {
                  pSize++;
                  q = q.nextZ;
                  if (!q) break;
              }
              qSize = inSize;

              while (pSize > 0 || (qSize > 0 && q)) {

                  if (pSize !== 0 && (qSize === 0 || !q || p.z <= q.z)) {
                      e = p;
                      p = p.nextZ;
                      pSize--;
                  } else {
                      e = q;
                      q = q.nextZ;
                      qSize--;
                  }

                  if (tail) tail.nextZ = e;
                  else list = e;

                  e.prevZ = tail;
                  tail = e;
              }

              p = q;
          }

          tail.nextZ = null;
          inSize *= 2;

      } while (numMerges > 1);

      return list;
  }

  // z-order of a point given coords and inverse of the longer side of data bbox
  function zOrder(x, y, minX, minY, invSize) {
      // coords are transformed into non-negative 15-bit integer range
      x = (x - minX) * invSize | 0;
      y = (y - minY) * invSize | 0;

      x = (x | (x << 8)) & 0x00FF00FF;
      x = (x | (x << 4)) & 0x0F0F0F0F;
      x = (x | (x << 2)) & 0x33333333;
      x = (x | (x << 1)) & 0x55555555;

      y = (y | (y << 8)) & 0x00FF00FF;
      y = (y | (y << 4)) & 0x0F0F0F0F;
      y = (y | (y << 2)) & 0x33333333;
      y = (y | (y << 1)) & 0x55555555;

      return x | (y << 1);
  }

  // find the leftmost node of a polygon ring
  function getLeftmost(start) {
      var p = start,
          leftmost = start;
      do {
          if (p.x < leftmost.x || (p.x === leftmost.x && p.y < leftmost.y)) leftmost = p;
          p = p.next;
      } while (p !== start);

      return leftmost;
  }

  // check if a point lies within a convex triangle
  function pointInTriangle(ax, ay, bx, by, cx, cy, px, py) {
      return (cx - px) * (ay - py) >= (ax - px) * (cy - py) &&
             (ax - px) * (by - py) >= (bx - px) * (ay - py) &&
             (bx - px) * (cy - py) >= (cx - px) * (by - py);
  }

  // check if a diagonal between two polygon nodes is valid (lies in polygon interior)
  function isValidDiagonal(a, b) {
      return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) && // dones't intersect other edges
             (locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) && // locally visible
              (area(a.prev, a, b.prev) || area(a, b.prev, b)) || // does not create opposite-facing sectors
              equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0); // special zero-length case
  }

  // signed area of a triangle
  function area(p, q, r) {
      return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  }

  // check if two points are equal
  function equals(p1, p2) {
      return p1.x === p2.x && p1.y === p2.y;
  }

  // check if two segments intersect
  function intersects$1(p1, q1, p2, q2) {
      var o1 = sign(area(p1, q1, p2));
      var o2 = sign(area(p1, q1, q2));
      var o3 = sign(area(p2, q2, p1));
      var o4 = sign(area(p2, q2, q1));

      if (o1 !== o2 && o3 !== o4) return true; // general case

      if (o1 === 0 && onSegment(p1, p2, q1)) return true; // p1, q1 and p2 are collinear and p2 lies on p1q1
      if (o2 === 0 && onSegment(p1, q2, q1)) return true; // p1, q1 and q2 are collinear and q2 lies on p1q1
      if (o3 === 0 && onSegment(p2, p1, q2)) return true; // p2, q2 and p1 are collinear and p1 lies on p2q2
      if (o4 === 0 && onSegment(p2, q1, q2)) return true; // p2, q2 and q1 are collinear and q1 lies on p2q2

      return false;
  }

  // for collinear points p, q, r, check if point q lies on segment pr
  function onSegment(p, q, r) {
      return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  }

  function sign(num) {
      return num > 0 ? 1 : num < 0 ? -1 : 0;
  }

  // check if a polygon diagonal intersects any polygon segments
  function intersectsPolygon(a, b) {
      var p = a;
      do {
          if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i &&
                  intersects$1(p, p.next, a, b)) return true;
          p = p.next;
      } while (p !== a);

      return false;
  }

  // check if a polygon diagonal is locally inside the polygon
  function locallyInside(a, b) {
      return area(a.prev, a, a.next) < 0 ?
          area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 :
          area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
  }

  // check if the middle point of a polygon diagonal is inside the polygon
  function middleInside(a, b) {
      var p = a,
          inside = false,
          px = (a.x + b.x) / 2,
          py = (a.y + b.y) / 2;
      do {
          if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y &&
                  (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x))
              inside = !inside;
          p = p.next;
      } while (p !== a);

      return inside;
  }

  // link two polygon vertices with a bridge; if the vertices belong to the same ring, it splits polygon into two;
  // if one belongs to the outer ring and another to a hole, it merges it into a single ring
  function splitPolygon(a, b) {
      var a2 = new Node(a.i, a.x, a.y),
          b2 = new Node(b.i, b.x, b.y),
          an = a.next,
          bp = b.prev;

      a.next = b;
      b.prev = a;

      a2.next = an;
      an.prev = a2;

      b2.next = a2;
      a2.prev = b2;

      bp.next = b2;
      b2.prev = bp;

      return b2;
  }

  // create a node and optionally link it with previous one (in a circular doubly linked list)
  function insertNode(i, x, y, last) {
      var p = new Node(i, x, y);

      if (!last) {
          p.prev = p;
          p.next = p;

      } else {
          p.next = last.next;
          p.prev = last;
          last.next.prev = p;
          last.next = p;
      }
      return p;
  }

  function removeNode(p) {
      p.next.prev = p.prev;
      p.prev.next = p.next;

      if (p.prevZ) p.prevZ.nextZ = p.nextZ;
      if (p.nextZ) p.nextZ.prevZ = p.prevZ;
  }

  function Node(i, x, y) {
      // vertex index in coordinates array
      this.i = i;

      // vertex coordinates
      this.x = x;
      this.y = y;

      // previous and next vertex nodes in a polygon ring
      this.prev = null;
      this.next = null;

      // z-order curve value
      this.z = 0;

      // previous and next nodes in z-order
      this.prevZ = null;
      this.nextZ = null;

      // indicates whether this is a steiner point
      this.steiner = false;
  }

  // return a percentage difference between the polygon area and its triangulation area;
  // used to verify correctness of triangulation
  earcut.deviation = function (data, holeIndices, dim, triangles) {
      var hasHoles = holeIndices && holeIndices.length;
      var outerLen = hasHoles ? holeIndices[0] * dim : data.length;

      var polygonArea = Math.abs(signedArea(data, 0, outerLen, dim));
      if (hasHoles) {
          for (var i = 0, len = holeIndices.length; i < len; i++) {
              var start = holeIndices[i] * dim;
              var end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
              polygonArea -= Math.abs(signedArea(data, start, end, dim));
          }
      }

      var trianglesArea = 0;
      for (i = 0; i < triangles.length; i += 3) {
          var a = triangles[i] * dim;
          var b = triangles[i + 1] * dim;
          var c = triangles[i + 2] * dim;
          trianglesArea += Math.abs(
              (data[a] - data[c]) * (data[b + 1] - data[a + 1]) -
              (data[a] - data[b]) * (data[c + 1] - data[a + 1]));
      }

      return polygonArea === 0 && trianglesArea === 0 ? 0 :
          Math.abs((trianglesArea - polygonArea) / polygonArea);
  };

  function signedArea(data, start, end, dim) {
      var sum = 0;
      for (var i = start, j = end - dim; i < end; i += dim) {
          sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
          j = i;
      }
      return sum;
  }

  // turn a polygon in a multi-dimensional array form (e.g. as in GeoJSON) into a form Earcut accepts
  earcut.flatten = function (data) {
      var dim = data[0][0].length,
          result = {vertices: [], holes: [], dimensions: dim},
          holeIndex = 0;

      for (var i = 0; i < data.length; i++) {
          for (var j = 0; j < data[i].length; j++) {
              for (var d = 0; d < dim; d++) result.vertices.push(data[i][j][d]);
          }
          if (i > 0) {
              holeIndex += data[i - 1].length;
              result.holes.push(holeIndex);
          }
      }
      return result;
  };

  var earcutExports = earcut$2.exports;
  var earcut$1 = /*@__PURE__*/getDefaultExportFromCjs(earcutExports);

  var shared, worker, wgw;
  function define(_, chunk) {
    if (!shared) {
      shared = chunk;
    } else if (!worker) {
      worker = chunk;
    } else {
      var workerBundleString = "var sharedChunk = {}; (" + shared + ")(sharedChunk); (" + worker + ")(sharedChunk);";
      var sharedChunk = {};
      shared(sharedChunk);
      wgw = chunk(sharedChunk);
      if (typeof window !== "undefined") {
        wgw.setWorkerUrl(window.URL.createObjectURL(new Blob([workerBundleString], { type: "text/javascript" })));
      }
    }
  }
  define(["exports"], function(exports) {
    function asyncAll(array, fn, callback) {
      if (!array.length) {
        return callback(null, []);
      }
      let remaining = array.length;
      const results = new Array(array.length);
      let error = null;
      array.forEach((item, i2) => {
        fn(item, (err, result) => {
          if (err) {
            error = err;
          }
          results[i2] = result;
          if (--remaining === 0)
            callback(error, results);
        });
      });
    }
    function isWorker() {
      return typeof WorkerGlobalScope !== "undefined" && typeof self !== "undefined" && self instanceof WorkerGlobalScope;
    }
    const warnOnceHistory = {};
    function warnOnce(message) {
      if (!warnOnceHistory[message]) {
        if (typeof console !== "undefined")
          console.warn(message);
        warnOnceHistory[message] = true;
      }
    }
    function isImageBitmap2(image) {
      return typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap;
    }
    function isArrayBuffer(value) {
      return value && typeof ArrayBuffer !== "undefined" && (value instanceof ArrayBuffer || value.constructor && value.constructor.name === "ArrayBuffer");
    }
    let _isSafari = null;
    function isSafari(scope) {
      if (_isSafari == null) {
        const userAgent = scope.navigator ? scope.navigator.userAgent : null;
        _isSafari = !!scope.safari || !!(userAgent && (/\b(iPad|iPhone|iPod)\b/.test(userAgent) || !!userAgent.match("Safari") && !userAgent.match("Chrome")));
      }
      return _isSafari;
    }
    function nullFunction() {
    }
    const uidCounters = {};
    function uid(id = "id") {
      uidCounters[id] = uidCounters[id] ?? 0;
      const count = uidCounters[id]++;
      return `${id}-${count}`;
    }
    function typeOf(value) {
      return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
    }
    function isFunction2(v2) {
      return typeOf(v2) === "function";
    }
    const getReferrer = isWorker() ? () => self.worker && self.worker.referrer : () => (window.location.protocol === "blob:" ? window.parent : window).location.href;
    function arrayBufferToImageBitmap(data, callback) {
      const blob = new Blob([new Uint8Array(data)], { type: "image/png" });
      createImageBitmap(blob).then((imgBitmap) => {
        callback(null, imgBitmap);
      }).catch((e2) => {
        callback(
          new Error(
            `Could not load image because of ${e2.message}. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.`
          )
        );
      });
    }
    const transparentPngUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=";
    function arrayBufferToImage(data, callback) {
      const img = new Image();
      img.onload = () => {
        callback(null, img);
        URL.revokeObjectURL(img.src);
        img.onload = null;
        window.requestAnimationFrame(() => {
          img.src = transparentPngUrl;
        });
      };
      img.onerror = () => callback(
        new Error(
          "Could not load image. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported."
        )
      );
      const blob = new Blob([new Uint8Array(data)], { type: "image/png" });
      img.src = data.byteLength ? URL.createObjectURL(blob) : transparentPngUrl;
    }
    function unflatten(valuesInOneDimension, size) {
      const { height, width } = size;
      const valuesInTwoDimensions = [];
      for (let y2 = 0; y2 < height; y2++) {
        const start = y2 * width;
        const end = start + width;
        valuesInTwoDimensions.push(valuesInOneDimension.slice(start, end));
      }
      return valuesInTwoDimensions;
    }
    function parseMetedata(str) {
      const array = str.split(",");
      const res = array.map((item) => {
        const kv = item.split(":");
        return {
          [kv[0]]: isNaN(parseFloat(kv[1])) ? kv[1] : parseFloat(kv[1])
        };
      });
      return res.reduce((pre, cur) => Object.assign({}, pre, cur), {});
    }
    var utils2 = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      arrayBufferToImage,
      arrayBufferToImageBitmap,
      asyncAll,
      getReferrer,
      isArrayBuffer,
      isFunction: isFunction2,
      isImageBitmap: isImageBitmap2,
      isSafari,
      isWorker,
      nullFunction,
      parseMetedata,
      typeOf,
      uid,
      unflatten,
      warnOnce
    });
    function e(e2, t2, i2) {
      return t2 in e2 ? Object.defineProperty(e2, t2, { value: i2, enumerable: true, configurable: true, writable: true }) : e2[t2] = i2, e2;
    }
    var t = "undefined" != typeof self ? self : global;
    const i = "undefined" != typeof navigator, s = i && "undefined" == typeof HTMLImageElement, n = !("undefined" == typeof global || "undefined" == typeof process || !process.versions || !process.versions.node), r = t.Buffer, a = t.BigInt, o = !!r, h = (e2) => f(e2) ? void 0 : e2, l = (e2) => void 0 !== e2;
    function f(e2) {
      return void 0 === e2 || (e2 instanceof Map ? 0 === e2.size : 0 === Object.values(e2).filter(l).length);
    }
    function u(e2) {
      let t2 = new Error(e2);
      throw delete t2.stack, t2;
    }
    function d(e2) {
      return "" === (e2 = function(e3) {
        for (; e3.endsWith("\0"); )
          e3 = e3.slice(0, -1);
        return e3;
      }(e2).trim()) ? void 0 : e2;
    }
    function c(e2) {
      let t2 = function(e3) {
        let t3 = 0;
        return e3.ifd0.enabled && (t3 += 1024), e3.exif.enabled && (t3 += 2048), e3.makerNote && (t3 += 2048), e3.userComment && (t3 += 1024), e3.gps.enabled && (t3 += 512), e3.interop.enabled && (t3 += 100), e3.ifd1.enabled && (t3 += 1024), t3 + 2048;
      }(e2);
      return e2.jfif.enabled && (t2 += 50), e2.xmp.enabled && (t2 += 2e4), e2.iptc.enabled && (t2 += 14e3), e2.icc.enabled && (t2 += 6e3), t2;
    }
    const g = (e2) => String.fromCharCode.apply(null, e2), p = "undefined" != typeof TextDecoder ? new TextDecoder("utf-8") : void 0;
    function m(e2) {
      return p ? p.decode(e2) : o ? Buffer.from(e2).toString("utf8") : decodeURIComponent(escape(g(e2)));
    }
    class y {
      static from(e2, t2) {
        return e2 instanceof this && e2.le === t2 ? e2 : new y(e2, void 0, void 0, t2);
      }
      constructor(e2, t2 = 0, i2, s2) {
        if ("boolean" == typeof s2 && (this.le = s2), Array.isArray(e2) && (e2 = new Uint8Array(e2)), 0 === e2)
          this.byteOffset = 0, this.byteLength = 0;
        else if (e2 instanceof ArrayBuffer) {
          void 0 === i2 && (i2 = e2.byteLength - t2);
          let s3 = new DataView(e2, t2, i2);
          this._swapDataView(s3);
        } else if (e2 instanceof Uint8Array || e2 instanceof DataView || e2 instanceof y) {
          void 0 === i2 && (i2 = e2.byteLength - t2), (t2 += e2.byteOffset) + i2 > e2.byteOffset + e2.byteLength && u("Creating view outside of available memory in ArrayBuffer");
          let s3 = new DataView(e2.buffer, t2, i2);
          this._swapDataView(s3);
        } else if ("number" == typeof e2) {
          let t3 = new DataView(new ArrayBuffer(e2));
          this._swapDataView(t3);
        } else
          u("Invalid input argument for BufferView: " + e2);
      }
      _swapArrayBuffer(e2) {
        this._swapDataView(new DataView(e2));
      }
      _swapBuffer(e2) {
        this._swapDataView(new DataView(e2.buffer, e2.byteOffset, e2.byteLength));
      }
      _swapDataView(e2) {
        this.dataView = e2, this.buffer = e2.buffer, this.byteOffset = e2.byteOffset, this.byteLength = e2.byteLength;
      }
      _lengthToEnd(e2) {
        return this.byteLength - e2;
      }
      set(e2, t2, i2 = y) {
        return e2 instanceof DataView || e2 instanceof y ? e2 = new Uint8Array(e2.buffer, e2.byteOffset, e2.byteLength) : e2 instanceof ArrayBuffer && (e2 = new Uint8Array(e2)), e2 instanceof Uint8Array || u("BufferView.set(): Invalid data argument."), this.toUint8().set(e2, t2), new i2(this, t2, e2.byteLength);
      }
      subarray(e2, t2) {
        return t2 = t2 || this._lengthToEnd(e2), new y(this, e2, t2);
      }
      toUint8() {
        return new Uint8Array(this.buffer, this.byteOffset, this.byteLength);
      }
      getUint8Array(e2, t2) {
        return new Uint8Array(this.buffer, this.byteOffset + e2, t2);
      }
      getString(e2 = 0, t2 = this.byteLength) {
        return m(this.getUint8Array(e2, t2));
      }
      getLatin1String(e2 = 0, t2 = this.byteLength) {
        let i2 = this.getUint8Array(e2, t2);
        return g(i2);
      }
      getUnicodeString(e2 = 0, t2 = this.byteLength) {
        const i2 = [];
        for (let s2 = 0; s2 < t2 && e2 + s2 < this.byteLength; s2 += 2)
          i2.push(this.getUint16(e2 + s2));
        return g(i2);
      }
      getInt8(e2) {
        return this.dataView.getInt8(e2);
      }
      getUint8(e2) {
        return this.dataView.getUint8(e2);
      }
      getInt16(e2, t2 = this.le) {
        return this.dataView.getInt16(e2, t2);
      }
      getInt32(e2, t2 = this.le) {
        return this.dataView.getInt32(e2, t2);
      }
      getUint16(e2, t2 = this.le) {
        return this.dataView.getUint16(e2, t2);
      }
      getUint32(e2, t2 = this.le) {
        return this.dataView.getUint32(e2, t2);
      }
      getFloat32(e2, t2 = this.le) {
        return this.dataView.getFloat32(e2, t2);
      }
      getFloat64(e2, t2 = this.le) {
        return this.dataView.getFloat64(e2, t2);
      }
      getFloat(e2, t2 = this.le) {
        return this.dataView.getFloat32(e2, t2);
      }
      getDouble(e2, t2 = this.le) {
        return this.dataView.getFloat64(e2, t2);
      }
      getUintBytes(e2, t2, i2) {
        switch (t2) {
          case 1:
            return this.getUint8(e2, i2);
          case 2:
            return this.getUint16(e2, i2);
          case 4:
            return this.getUint32(e2, i2);
          case 8:
            return this.getUint64 && this.getUint64(e2, i2);
        }
      }
      getUint(e2, t2, i2) {
        switch (t2) {
          case 8:
            return this.getUint8(e2, i2);
          case 16:
            return this.getUint16(e2, i2);
          case 32:
            return this.getUint32(e2, i2);
          case 64:
            return this.getUint64 && this.getUint64(e2, i2);
        }
      }
      toString(e2) {
        return this.dataView.toString(e2, this.constructor.name);
      }
      ensureChunk() {
      }
    }
    function b(e2, t2) {
      u(`${e2} '${t2}' was not loaded, try using full build of exifr.`);
    }
    class w extends Map {
      constructor(e2) {
        super(), this.kind = e2;
      }
      get(e2, t2) {
        return this.has(e2) || b(this.kind, e2), t2 && (e2 in t2 || function(e3, t3) {
          u(`Unknown ${e3} '${t3}'.`);
        }(this.kind, e2), t2[e2].enabled || b(this.kind, e2)), super.get(e2);
      }
      keyList() {
        return Array.from(this.keys());
      }
    }
    var S = new w("file parser"), k = new w("segment parser"), v = new w("file reader");
    let O = t.fetch;
    function x(e2, t2) {
      return (s2 = e2).startsWith("data:") || s2.length > 1e4 ? P(e2, t2, "base64") : n && e2.includes("://") ? C(e2, t2, "url", A) : n ? P(e2, t2, "fs") : i ? C(e2, t2, "url", A) : void u("Invalid input argument");
      var s2;
    }
    async function C(e2, t2, i2, s2) {
      return v.has(i2) ? P(e2, t2, i2) : s2 ? async function(e3, t3) {
        let i3 = await t3(e3);
        return new y(i3);
      }(e2, s2) : void u(`Parser ${i2} is not loaded`);
    }
    async function P(e2, t2, i2) {
      let s2 = new (v.get(i2))(e2, t2);
      return await s2.read(), s2;
    }
    const A = (e2) => O(e2).then((e3) => e3.arrayBuffer()), U = (e2) => new Promise((t2, i2) => {
      let s2 = new FileReader();
      s2.onloadend = () => t2(s2.result || new ArrayBuffer()), s2.onerror = i2, s2.readAsArrayBuffer(e2);
    });
    class I extends Map {
      get tagKeys() {
        return this.allKeys || (this.allKeys = Array.from(this.keys())), this.allKeys;
      }
      get tagValues() {
        return this.allValues || (this.allValues = Array.from(this.values())), this.allValues;
      }
    }
    function B(e2, t2, i2) {
      let s2 = new I();
      for (let [e3, t3] of i2)
        s2.set(e3, t3);
      if (Array.isArray(t2))
        for (let i3 of t2)
          e2.set(i3, s2);
      else
        e2.set(t2, s2);
      return s2;
    }
    const L = /* @__PURE__ */ new Map(), D = /* @__PURE__ */ new Map(), T = /* @__PURE__ */ new Map(), z = ["chunked", "firstChunkSize", "firstChunkSizeNode", "firstChunkSizeBrowser", "chunkSize", "chunkLimit"], N = ["jfif", "xmp", "icc", "iptc", "ihdr"], V = ["tiff", ...N], M = ["ifd0", "ifd1", "exif", "gps", "interop"], E = [...V, ...M], R = ["makerNote", "userComment"], j = ["translateKeys", "translateValues", "reviveValues", "multiSegment"], G = [...j, "sanitize", "mergeOutput", "silentErrors"];
    class H {
      get translate() {
        return this.translateKeys || this.translateValues || this.reviveValues;
      }
    }
    class _ extends H {
      get needed() {
        return this.enabled || this.deps.size > 0;
      }
      constructor(t2, i2, s2, n2) {
        if (super(), e(this, "enabled", false), e(this, "skip", /* @__PURE__ */ new Set()), e(this, "pick", /* @__PURE__ */ new Set()), e(this, "deps", /* @__PURE__ */ new Set()), e(this, "translateKeys", false), e(this, "translateValues", false), e(this, "reviveValues", false), this.key = t2, this.enabled = i2, this.parse = this.enabled, this.applyInheritables(n2), this.canBeFiltered = M.includes(t2), this.canBeFiltered && (this.dict = L.get(t2)), void 0 !== s2)
          if (Array.isArray(s2))
            this.parse = this.enabled = true, this.canBeFiltered && s2.length > 0 && this.translateTagSet(s2, this.pick);
          else if ("object" == typeof s2) {
            if (this.enabled = true, this.parse = false !== s2.parse, this.canBeFiltered) {
              let { pick: e2, skip: t3 } = s2;
              e2 && e2.length > 0 && this.translateTagSet(e2, this.pick), t3 && t3.length > 0 && this.translateTagSet(t3, this.skip);
            }
            this.applyInheritables(s2);
          } else
            true === s2 || false === s2 ? this.parse = this.enabled = s2 : u(`Invalid options argument: ${s2}`);
      }
      applyInheritables(e2) {
        let t2, i2;
        for (t2 of j)
          i2 = e2[t2], void 0 !== i2 && (this[t2] = i2);
      }
      translateTagSet(e2, t2) {
        if (this.dict) {
          let i2, s2, { tagKeys: n2, tagValues: r2 } = this.dict;
          for (i2 of e2)
            "string" == typeof i2 ? (s2 = r2.indexOf(i2), -1 === s2 && (s2 = n2.indexOf(Number(i2))), -1 !== s2 && t2.add(Number(n2[s2]))) : t2.add(i2);
        } else
          for (let i2 of e2)
            t2.add(i2);
      }
      finalizeFilters() {
        !this.enabled && this.deps.size > 0 ? (this.enabled = true, q(this.pick, this.deps)) : this.enabled && this.pick.size > 0 && q(this.pick, this.deps);
      }
    }
    var W = { jfif: false, tiff: true, xmp: false, icc: false, iptc: false, ifd0: true, ifd1: false, exif: true, gps: true, interop: false, ihdr: void 0, makerNote: false, userComment: false, multiSegment: false, skip: [], pick: [], translateKeys: true, translateValues: true, reviveValues: true, sanitize: true, mergeOutput: true, silentErrors: true, chunked: true, firstChunkSize: void 0, firstChunkSizeNode: 512, firstChunkSizeBrowser: 65536, chunkSize: 65536, chunkLimit: 5 }, $ = /* @__PURE__ */ new Map();
    class K extends H {
      static useCached(e2) {
        let t2 = $.get(e2);
        return void 0 !== t2 || (t2 = new this(e2), $.set(e2, t2)), t2;
      }
      constructor(e2) {
        super(), true === e2 ? this.setupFromTrue() : void 0 === e2 ? this.setupFromUndefined() : Array.isArray(e2) ? this.setupFromArray(e2) : "object" == typeof e2 ? this.setupFromObject(e2) : u(`Invalid options argument ${e2}`), void 0 === this.firstChunkSize && (this.firstChunkSize = i ? this.firstChunkSizeBrowser : this.firstChunkSizeNode), this.mergeOutput && (this.ifd1.enabled = false), this.filterNestedSegmentTags(), this.traverseTiffDependencyTree(), this.checkLoadedPlugins();
      }
      setupFromUndefined() {
        let e2;
        for (e2 of z)
          this[e2] = W[e2];
        for (e2 of G)
          this[e2] = W[e2];
        for (e2 of R)
          this[e2] = W[e2];
        for (e2 of E)
          this[e2] = new _(e2, W[e2], void 0, this);
      }
      setupFromTrue() {
        let e2;
        for (e2 of z)
          this[e2] = W[e2];
        for (e2 of G)
          this[e2] = W[e2];
        for (e2 of R)
          this[e2] = true;
        for (e2 of E)
          this[e2] = new _(e2, true, void 0, this);
      }
      setupFromArray(e2) {
        let t2;
        for (t2 of z)
          this[t2] = W[t2];
        for (t2 of G)
          this[t2] = W[t2];
        for (t2 of R)
          this[t2] = W[t2];
        for (t2 of E)
          this[t2] = new _(t2, false, void 0, this);
        this.setupGlobalFilters(e2, void 0, M);
      }
      setupFromObject(e2) {
        let t2;
        for (t2 of (M.ifd0 = M.ifd0 || M.image, M.ifd1 = M.ifd1 || M.thumbnail, Object.assign(this, e2), z))
          this[t2] = Y(e2[t2], W[t2]);
        for (t2 of G)
          this[t2] = Y(e2[t2], W[t2]);
        for (t2 of R)
          this[t2] = Y(e2[t2], W[t2]);
        for (t2 of V)
          this[t2] = new _(t2, W[t2], e2[t2], this);
        for (t2 of M)
          this[t2] = new _(t2, W[t2], e2[t2], this.tiff);
        this.setupGlobalFilters(e2.pick, e2.skip, M, E), true === e2.tiff ? this.batchEnableWithBool(M, true) : false === e2.tiff ? this.batchEnableWithUserValue(M, e2) : Array.isArray(e2.tiff) ? this.setupGlobalFilters(e2.tiff, void 0, M) : "object" == typeof e2.tiff && this.setupGlobalFilters(e2.tiff.pick, e2.tiff.skip, M);
      }
      batchEnableWithBool(e2, t2) {
        for (let i2 of e2)
          this[i2].enabled = t2;
      }
      batchEnableWithUserValue(e2, t2) {
        for (let i2 of e2) {
          let e3 = t2[i2];
          this[i2].enabled = false !== e3 && void 0 !== e3;
        }
      }
      setupGlobalFilters(e2, t2, i2, s2 = i2) {
        if (e2 && e2.length) {
          for (let e3 of s2)
            this[e3].enabled = false;
          let t3 = X(e2, i2);
          for (let [e3, i3] of t3)
            q(this[e3].pick, i3), this[e3].enabled = true;
        } else if (t2 && t2.length) {
          let e3 = X(t2, i2);
          for (let [t3, i3] of e3)
            q(this[t3].skip, i3);
        }
      }
      filterNestedSegmentTags() {
        let { ifd0: e2, exif: t2, xmp: i2, iptc: s2, icc: n2 } = this;
        this.makerNote ? t2.deps.add(37500) : t2.skip.add(37500), this.userComment ? t2.deps.add(37510) : t2.skip.add(37510), i2.enabled || e2.skip.add(700), s2.enabled || e2.skip.add(33723), n2.enabled || e2.skip.add(34675);
      }
      traverseTiffDependencyTree() {
        let { ifd0: e2, exif: t2, gps: i2, interop: s2 } = this;
        s2.needed && (t2.deps.add(40965), e2.deps.add(40965)), t2.needed && e2.deps.add(34665), i2.needed && e2.deps.add(34853), this.tiff.enabled = M.some((e3) => true === this[e3].enabled) || this.makerNote || this.userComment;
        for (let e3 of M)
          this[e3].finalizeFilters();
      }
      get onlyTiff() {
        return !N.map((e2) => this[e2].enabled).some((e2) => true === e2) && this.tiff.enabled;
      }
      checkLoadedPlugins() {
        for (let e2 of V)
          this[e2].enabled && !k.has(e2) && b("segment parser", e2);
      }
    }
    function X(e2, t2) {
      let i2, s2, n2, r2, a2 = [];
      for (n2 of t2) {
        for (r2 of (i2 = L.get(n2), s2 = [], i2))
          (e2.includes(r2[0]) || e2.includes(r2[1])) && s2.push(r2[0]);
        s2.length && a2.push([n2, s2]);
      }
      return a2;
    }
    function Y(e2, t2) {
      return void 0 !== e2 ? e2 : void 0 !== t2 ? t2 : void 0;
    }
    function q(e2, t2) {
      for (let i2 of t2)
        e2.add(i2);
    }
    e(K, "default", W);
    class J {
      constructor(t2) {
        e(this, "parsers", {}), e(this, "output", {}), e(this, "errors", []), e(this, "pushToErrors", (e2) => this.errors.push(e2)), this.options = K.useCached(t2);
      }
      async read(e2) {
        this.file = await function(e3, t2) {
          return "string" == typeof e3 ? x(e3, t2) : i && !s && e3 instanceof HTMLImageElement ? x(e3.src, t2) : e3 instanceof Uint8Array || e3 instanceof ArrayBuffer || e3 instanceof DataView ? new y(e3) : i && e3 instanceof Blob ? C(e3, t2, "blob", U) : void u("Invalid input argument");
        }(e2, this.options);
      }
      setup() {
        if (this.fileParser)
          return;
        let { file: e2 } = this, t2 = e2.getUint16(0);
        for (let [i2, s2] of S)
          if (s2.canHandle(e2, t2))
            return this.fileParser = new s2(this.options, this.file, this.parsers), e2[i2] = true;
        this.file.close && this.file.close(), u("Unknown file format");
      }
      async parse() {
        let { output: e2, errors: t2 } = this;
        return this.setup(), this.options.silentErrors ? (await this.executeParsers().catch(this.pushToErrors), t2.push(...this.fileParser.errors)) : await this.executeParsers(), this.file.close && this.file.close(), this.options.silentErrors && t2.length > 0 && (e2.errors = t2), h(e2);
      }
      async executeParsers() {
        let { output: e2 } = this;
        await this.fileParser.parse();
        let t2 = Object.values(this.parsers).map(async (t3) => {
          let i2 = await t3.parse();
          t3.assignToOutput(e2, i2);
        });
        this.options.silentErrors && (t2 = t2.map((e3) => e3.catch(this.pushToErrors))), await Promise.all(t2);
      }
      async extractThumbnail() {
        this.setup();
        let { options: e2, file: t2 } = this, i2 = k.get("tiff", e2);
        var s2;
        if (t2.tiff ? s2 = { start: 0, type: "tiff" } : t2.jpeg && (s2 = await this.fileParser.getOrFindSegment("tiff")), void 0 === s2)
          return;
        let n2 = await this.fileParser.ensureSegmentChunk(s2), r2 = this.parsers.tiff = new i2(n2, e2, t2), a2 = await r2.extractThumbnail();
        return t2.close && t2.close(), a2;
      }
    }
    async function Z(e2, t2) {
      let i2 = new J(t2);
      return await i2.read(e2), i2.parse();
    }
    class ee {
      constructor(t2, i2, s2) {
        e(this, "errors", []), e(this, "ensureSegmentChunk", async (e2) => {
          let t3 = e2.start, i3 = e2.size || 65536;
          if (this.file.chunked)
            if (this.file.available(t3, i3))
              e2.chunk = this.file.subarray(t3, i3);
            else
              try {
                e2.chunk = await this.file.readChunk(t3, i3);
              } catch (t4) {
                u(`Couldn't read segment: ${JSON.stringify(e2)}. ${t4.message}`);
              }
          else
            this.file.byteLength > t3 + i3 ? e2.chunk = this.file.subarray(t3, i3) : void 0 === e2.size ? e2.chunk = this.file.subarray(t3) : u("Segment unreachable: " + JSON.stringify(e2));
          return e2.chunk;
        }), this.extendOptions && this.extendOptions(t2), this.options = t2, this.file = i2, this.parsers = s2;
      }
      injectSegment(e2, t2) {
        this.options[e2].enabled && this.createParser(e2, t2);
      }
      createParser(e2, t2) {
        let i2 = new (k.get(e2))(t2, this.options, this.file);
        return this.parsers[e2] = i2;
      }
      createParsers(e2) {
        for (let t2 of e2) {
          let { type: e3, chunk: i2 } = t2, s2 = this.options[e3];
          if (s2 && s2.enabled) {
            let t3 = this.parsers[e3];
            t3 && t3.append || t3 || this.createParser(e3, i2);
          }
        }
      }
      async readSegments(e2) {
        let t2 = e2.map(this.ensureSegmentChunk);
        await Promise.all(t2);
      }
    }
    class te {
      static findPosition(e2, t2) {
        let i2 = e2.getUint16(t2 + 2) + 2, s2 = "function" == typeof this.headerLength ? this.headerLength(e2, t2, i2) : this.headerLength, n2 = t2 + s2, r2 = i2 - s2;
        return { offset: t2, length: i2, headerLength: s2, start: n2, size: r2, end: n2 + r2 };
      }
      static parse(e2, t2 = {}) {
        return new this(e2, new K({ [this.type]: t2 }), e2).parse();
      }
      normalizeInput(e2) {
        return e2 instanceof y ? e2 : new y(e2);
      }
      constructor(t2, i2 = {}, s2) {
        e(this, "errors", []), e(this, "raw", /* @__PURE__ */ new Map()), e(this, "handleError", (e2) => {
          if (!this.options.silentErrors)
            throw e2;
          this.errors.push(e2.message);
        }), this.chunk = this.normalizeInput(t2), this.file = s2, this.type = this.constructor.type, this.globalOptions = this.options = i2, this.localOptions = i2[this.type], this.canTranslate = this.localOptions && this.localOptions.translate;
      }
      translate() {
        this.canTranslate && (this.translated = this.translateBlock(this.raw, this.type));
      }
      get output() {
        return this.translated ? this.translated : this.raw ? Object.fromEntries(this.raw) : void 0;
      }
      translateBlock(e2, t2) {
        let i2 = T.get(t2), s2 = D.get(t2), n2 = L.get(t2), r2 = this.options[t2], a2 = r2.reviveValues && !!i2, o2 = r2.translateValues && !!s2, h2 = r2.translateKeys && !!n2, l2 = {};
        for (let [t3, r3] of e2)
          a2 && i2.has(t3) ? r3 = i2.get(t3)(r3) : o2 && s2.has(t3) && (r3 = this.translateValue(r3, s2.get(t3))), h2 && n2.has(t3) && (t3 = n2.get(t3) || t3), l2[t3] = r3;
        return l2;
      }
      translateValue(e2, t2) {
        return t2[e2] || t2.DEFAULT || e2;
      }
      assignToOutput(e2, t2) {
        this.assignObjectToOutput(e2, this.constructor.type, t2);
      }
      assignObjectToOutput(e2, t2, i2) {
        if (this.globalOptions.mergeOutput)
          return Object.assign(e2, i2);
        e2[t2] ? Object.assign(e2[t2], i2) : e2[t2] = i2;
      }
    }
    e(te, "headerLength", 4), e(te, "type", void 0), e(te, "multiSegment", false), e(te, "canHandle", () => false);
    function ie(e2) {
      return 192 === e2 || 194 === e2 || 196 === e2 || 219 === e2 || 221 === e2 || 218 === e2 || 254 === e2;
    }
    function se(e2) {
      return e2 >= 224 && e2 <= 239;
    }
    function ne(e2, t2, i2) {
      for (let [s2, n2] of k)
        if (n2.canHandle(e2, t2, i2))
          return s2;
    }
    class re extends ee {
      constructor(...t2) {
        super(...t2), e(this, "appSegments", []), e(this, "jpegSegments", []), e(this, "unknownSegments", []);
      }
      static canHandle(e2, t2) {
        return 65496 === t2;
      }
      async parse() {
        await this.findAppSegments(), await this.readSegments(this.appSegments), this.mergeMultiSegments(), this.createParsers(this.mergedAppSegments || this.appSegments);
      }
      setupSegmentFinderArgs(e2) {
        true === e2 ? (this.findAll = true, this.wanted = new Set(k.keyList())) : (e2 = void 0 === e2 ? k.keyList().filter((e3) => this.options[e3].enabled) : e2.filter((e3) => this.options[e3].enabled && k.has(e3)), this.findAll = false, this.remaining = new Set(e2), this.wanted = new Set(e2)), this.unfinishedMultiSegment = false;
      }
      async findAppSegments(e2 = 0, t2) {
        this.setupSegmentFinderArgs(t2);
        let { file: i2, findAll: s2, wanted: n2, remaining: r2 } = this;
        if (!s2 && this.file.chunked && (s2 = Array.from(n2).some((e3) => {
          let t3 = k.get(e3), i3 = this.options[e3];
          return t3.multiSegment && i3.multiSegment;
        }), s2 && await this.file.readWhole()), e2 = this.findAppSegmentsInRange(e2, i2.byteLength), !this.options.onlyTiff && i2.chunked) {
          let t3 = false;
          for (; r2.size > 0 && !t3 && (i2.canReadNextChunk || this.unfinishedMultiSegment); ) {
            let { nextChunkOffset: s3 } = i2, n3 = this.appSegments.some((e3) => !this.file.available(e3.offset || e3.start, e3.length || e3.size));
            if (t3 = e2 > s3 && !n3 ? !await i2.readNextChunk(e2) : !await i2.readNextChunk(s3), void 0 === (e2 = this.findAppSegmentsInRange(e2, i2.byteLength)))
              return;
          }
        }
      }
      findAppSegmentsInRange(e2, t2) {
        t2 -= 2;
        let i2, s2, n2, r2, a2, o2, { file: h2, findAll: l2, wanted: f2, remaining: u2, options: d2 } = this;
        for (; e2 < t2; e2++)
          if (255 === h2.getUint8(e2)) {
            if (i2 = h2.getUint8(e2 + 1), se(i2)) {
              if (s2 = h2.getUint16(e2 + 2), n2 = ne(h2, e2, s2), n2 && f2.has(n2) && (r2 = k.get(n2), a2 = r2.findPosition(h2, e2), o2 = d2[n2], a2.type = n2, this.appSegments.push(a2), !l2 && (r2.multiSegment && o2.multiSegment ? (this.unfinishedMultiSegment = a2.chunkNumber < a2.chunkCount, this.unfinishedMultiSegment || u2.delete(n2)) : u2.delete(n2), 0 === u2.size)))
                break;
              d2.recordUnknownSegments && (a2 = te.findPosition(h2, e2), a2.marker = i2, this.unknownSegments.push(a2)), e2 += s2 + 1;
            } else if (ie(i2)) {
              if (s2 = h2.getUint16(e2 + 2), 218 === i2 && false !== d2.stopAfterSos)
                return;
              d2.recordJpegSegments && this.jpegSegments.push({ offset: e2, length: s2, marker: i2 }), e2 += s2 + 1;
            }
          }
        return e2;
      }
      mergeMultiSegments() {
        if (!this.appSegments.some((e3) => e3.multiSegment))
          return;
        let e2 = function(e3, t2) {
          let i2, s2, n2, r2 = /* @__PURE__ */ new Map();
          for (let a2 = 0; a2 < e3.length; a2++)
            i2 = e3[a2], s2 = i2[t2], r2.has(s2) ? n2 = r2.get(s2) : r2.set(s2, n2 = []), n2.push(i2);
          return Array.from(r2);
        }(this.appSegments, "type");
        this.mergedAppSegments = e2.map(([e3, t2]) => {
          let i2 = k.get(e3, this.options);
          if (i2.handleMultiSegments) {
            return { type: e3, chunk: i2.handleMultiSegments(t2) };
          }
          return t2[0];
        });
      }
      getSegment(e2) {
        return this.appSegments.find((t2) => t2.type === e2);
      }
      async getOrFindSegment(e2) {
        let t2 = this.getSegment(e2);
        return void 0 === t2 && (await this.findAppSegments(0, [e2]), t2 = this.getSegment(e2)), t2;
      }
    }
    e(re, "type", "jpeg"), S.set("jpeg", re);
    const ae = [void 0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8, 4];
    class oe extends te {
      parseHeader() {
        var e2 = this.chunk.getUint16();
        18761 === e2 ? this.le = true : 19789 === e2 && (this.le = false), this.chunk.le = this.le, this.headerParsed = true;
      }
      parseTags(e2, t2, i2 = /* @__PURE__ */ new Map()) {
        let { pick: s2, skip: n2 } = this.options[t2];
        s2 = new Set(s2);
        let r2 = s2.size > 0, a2 = 0 === n2.size, o2 = this.chunk.getUint16(e2);
        e2 += 2;
        for (let h2 = 0; h2 < o2; h2++) {
          let o3 = this.chunk.getUint16(e2);
          if (r2) {
            if (s2.has(o3) && (i2.set(o3, this.parseTag(e2, o3, t2)), s2.delete(o3), 0 === s2.size))
              break;
          } else
            !a2 && n2.has(o3) || i2.set(o3, this.parseTag(e2, o3, t2));
          e2 += 12;
        }
        return i2;
      }
      parseTag(e2, t2, i2) {
        let { chunk: s2 } = this, n2 = s2.getUint16(e2 + 2), r2 = s2.getUint32(e2 + 4), a2 = ae[n2];
        if (a2 * r2 <= 4 ? e2 += 8 : e2 = s2.getUint32(e2 + 8), (n2 < 1 || n2 > 13) && u(`Invalid TIFF value type. block: ${i2.toUpperCase()}, tag: ${t2.toString(16)}, type: ${n2}, offset ${e2}`), e2 > s2.byteLength && u(`Invalid TIFF value offset. block: ${i2.toUpperCase()}, tag: ${t2.toString(16)}, type: ${n2}, offset ${e2} is outside of chunk size ${s2.byteLength}`), 1 === n2)
          return s2.getUint8Array(e2, r2);
        if (2 === n2)
          return d(s2.getString(e2, r2));
        if (7 === n2)
          return s2.getUint8Array(e2, r2);
        if (1 === r2)
          return this.parseTagValue(n2, e2);
        {
          let t3 = new (function(e3) {
            switch (e3) {
              case 1:
                return Uint8Array;
              case 3:
                return Uint16Array;
              case 4:
                return Uint32Array;
              case 5:
                return Array;
              case 6:
                return Int8Array;
              case 8:
                return Int16Array;
              case 9:
                return Int32Array;
              case 10:
                return Array;
              case 11:
                return Float32Array;
              case 12:
                return Float64Array;
              default:
                return Array;
            }
          }(n2))(r2), i3 = a2;
          for (let s3 = 0; s3 < r2; s3++)
            t3[s3] = this.parseTagValue(n2, e2), e2 += i3;
          return t3;
        }
      }
      parseTagValue(e2, t2) {
        let { chunk: i2 } = this;
        switch (e2) {
          case 1:
            return i2.getUint8(t2);
          case 3:
            return i2.getUint16(t2);
          case 4:
            return i2.getUint32(t2);
          case 5:
            return i2.getUint32(t2) / i2.getUint32(t2 + 4);
          case 6:
            return i2.getInt8(t2);
          case 8:
            return i2.getInt16(t2);
          case 9:
            return i2.getInt32(t2);
          case 10:
            return i2.getInt32(t2) / i2.getInt32(t2 + 4);
          case 11:
            return i2.getFloat(t2);
          case 12:
            return i2.getDouble(t2);
          case 13:
            return i2.getUint32(t2);
          default:
            u(`Invalid tiff type ${e2}`);
        }
      }
    }
    class he extends oe {
      static canHandle(e2, t2) {
        return 225 === e2.getUint8(t2 + 1) && 1165519206 === e2.getUint32(t2 + 4) && 0 === e2.getUint16(t2 + 8);
      }
      async parse() {
        this.parseHeader();
        let { options: e2 } = this;
        return e2.ifd0.enabled && await this.parseIfd0Block(), e2.exif.enabled && await this.safeParse("parseExifBlock"), e2.gps.enabled && await this.safeParse("parseGpsBlock"), e2.interop.enabled && await this.safeParse("parseInteropBlock"), e2.ifd1.enabled && await this.safeParse("parseThumbnailBlock"), this.createOutput();
      }
      safeParse(e2) {
        let t2 = this[e2]();
        return void 0 !== t2.catch && (t2 = t2.catch(this.handleError)), t2;
      }
      findIfd0Offset() {
        void 0 === this.ifd0Offset && (this.ifd0Offset = this.chunk.getUint32(4));
      }
      findIfd1Offset() {
        if (void 0 === this.ifd1Offset) {
          this.findIfd0Offset();
          let e2 = this.chunk.getUint16(this.ifd0Offset), t2 = this.ifd0Offset + 2 + 12 * e2;
          this.ifd1Offset = this.chunk.getUint32(t2);
        }
      }
      parseBlock(e2, t2) {
        let i2 = /* @__PURE__ */ new Map();
        return this[t2] = i2, this.parseTags(e2, t2, i2), i2;
      }
      async parseIfd0Block() {
        if (this.ifd0)
          return;
        let { file: e2 } = this;
        this.findIfd0Offset(), this.ifd0Offset < 8 && u("Malformed EXIF data"), !e2.chunked && this.ifd0Offset > e2.byteLength && u(`IFD0 offset points to outside of file.
this.ifd0Offset: ${this.ifd0Offset}, file.byteLength: ${e2.byteLength}`), e2.tiff && await e2.ensureChunk(this.ifd0Offset, c(this.options));
        let t2 = this.parseBlock(this.ifd0Offset, "ifd0");
        return 0 !== t2.size ? (this.exifOffset = t2.get(34665), this.interopOffset = t2.get(40965), this.gpsOffset = t2.get(34853), this.xmp = t2.get(700), this.iptc = t2.get(33723), this.icc = t2.get(34675), this.options.sanitize && (t2.delete(34665), t2.delete(40965), t2.delete(34853), t2.delete(700), t2.delete(33723), t2.delete(34675)), t2) : void 0;
      }
      async parseExifBlock() {
        if (this.exif)
          return;
        if (this.ifd0 || await this.parseIfd0Block(), void 0 === this.exifOffset)
          return;
        this.file.tiff && await this.file.ensureChunk(this.exifOffset, c(this.options));
        let e2 = this.parseBlock(this.exifOffset, "exif");
        return this.interopOffset || (this.interopOffset = e2.get(40965)), this.makerNote = e2.get(37500), this.userComment = e2.get(37510), this.options.sanitize && (e2.delete(40965), e2.delete(37500), e2.delete(37510)), this.unpack(e2, 41728), this.unpack(e2, 41729), e2;
      }
      unpack(e2, t2) {
        let i2 = e2.get(t2);
        i2 && 1 === i2.length && e2.set(t2, i2[0]);
      }
      async parseGpsBlock() {
        if (this.gps)
          return;
        if (this.ifd0 || await this.parseIfd0Block(), void 0 === this.gpsOffset)
          return;
        let e2 = this.parseBlock(this.gpsOffset, "gps");
        return e2 && e2.has(2) && e2.has(4) && (e2.set("latitude", le(...e2.get(2), e2.get(1))), e2.set("longitude", le(...e2.get(4), e2.get(3)))), e2;
      }
      async parseInteropBlock() {
        if (!this.interop && (this.ifd0 || await this.parseIfd0Block(), void 0 !== this.interopOffset || this.exif || await this.parseExifBlock(), void 0 !== this.interopOffset))
          return this.parseBlock(this.interopOffset, "interop");
      }
      async parseThumbnailBlock(e2 = false) {
        if (!this.ifd1 && !this.ifd1Parsed && (!this.options.mergeOutput || e2))
          return this.findIfd1Offset(), this.ifd1Offset > 0 && (this.parseBlock(this.ifd1Offset, "ifd1"), this.ifd1Parsed = true), this.ifd1;
      }
      async extractThumbnail() {
        if (this.headerParsed || this.parseHeader(), this.ifd1Parsed || await this.parseThumbnailBlock(true), void 0 === this.ifd1)
          return;
        let e2 = this.ifd1.get(513), t2 = this.ifd1.get(514);
        return this.chunk.getUint8Array(e2, t2);
      }
      get image() {
        return this.ifd0;
      }
      get thumbnail() {
        return this.ifd1;
      }
      createOutput() {
        let e2, t2, i2, s2 = {};
        for (t2 of M)
          if (e2 = this[t2], !f(e2))
            if (i2 = this.canTranslate ? this.translateBlock(e2, t2) : Object.fromEntries(e2), this.options.mergeOutput) {
              if ("ifd1" === t2)
                continue;
              Object.assign(s2, i2);
            } else
              s2[t2] = i2;
        return this.makerNote && (s2.makerNote = this.makerNote), this.userComment && (s2.userComment = this.userComment), s2;
      }
      assignToOutput(e2, t2) {
        if (this.globalOptions.mergeOutput)
          Object.assign(e2, t2);
        else
          for (let [i2, s2] of Object.entries(t2))
            this.assignObjectToOutput(e2, i2, s2);
      }
    }
    function le(e2, t2, i2, s2) {
      var n2 = e2 + t2 / 60 + i2 / 3600;
      return "S" !== s2 && "W" !== s2 || (n2 *= -1), n2;
    }
    e(he, "type", "tiff"), e(he, "headerLength", 10), k.set("tiff", he);
    const ue = { ifd0: false, ifd1: false, exif: false, gps: false, interop: false, sanitize: false, reviveValues: true, translateKeys: false, translateValues: false, mergeOutput: false };
    Object.assign({}, ue, { firstChunkSize: 4e4, gps: [1, 2, 3, 4] });
    Object.assign({}, ue, { tiff: false, ifd1: true, mergeOutput: false });
    Object.assign({}, ue, { firstChunkSize: 4e4, ifd0: [274] });
    if ("object" == typeof navigator) {
      let e2 = navigator.userAgent;
      if (e2.includes("iPad") || e2.includes("iPhone")) {
        e2.match(/OS (\d+)_(\d+)/);
      } else if (e2.includes("OS X 10")) {
        e2.match(/OS X 10[_.](\d+)/);
      }
      if (e2.includes("Chrome/")) {
        e2.match(/Chrome\/(\d+)/);
      } else if (e2.includes("Firefox/")) {
        e2.match(/Firefox\/(\d+)/);
      }
    }
    class Oe extends y {
      constructor(...t2) {
        super(...t2), e(this, "ranges", new xe()), 0 !== this.byteLength && this.ranges.add(0, this.byteLength);
      }
      _tryExtend(e2, t2, i2) {
        if (0 === e2 && 0 === this.byteLength && i2) {
          let e3 = new DataView(i2.buffer || i2, i2.byteOffset, i2.byteLength);
          this._swapDataView(e3);
        } else {
          let i3 = e2 + t2;
          if (i3 > this.byteLength) {
            let { dataView: e3 } = this._extend(i3);
            this._swapDataView(e3);
          }
        }
      }
      _extend(e2) {
        let t2;
        t2 = o ? r.allocUnsafe(e2) : new Uint8Array(e2);
        let i2 = new DataView(t2.buffer, t2.byteOffset, t2.byteLength);
        return t2.set(new Uint8Array(this.buffer, this.byteOffset, this.byteLength), 0), { uintView: t2, dataView: i2 };
      }
      subarray(e2, t2, i2 = false) {
        return t2 = t2 || this._lengthToEnd(e2), i2 && this._tryExtend(e2, t2), this.ranges.add(e2, t2), super.subarray(e2, t2);
      }
      set(e2, t2, i2 = false) {
        i2 && this._tryExtend(t2, e2.byteLength, e2);
        let s2 = super.set(e2, t2);
        return this.ranges.add(t2, s2.byteLength), s2;
      }
      async ensureChunk(e2, t2) {
        this.chunked && (this.ranges.available(e2, t2) || await this.readChunk(e2, t2));
      }
      available(e2, t2) {
        return this.ranges.available(e2, t2);
      }
    }
    class xe {
      constructor() {
        e(this, "list", []);
      }
      get length() {
        return this.list.length;
      }
      add(e2, t2, i2 = 0) {
        let s2 = e2 + t2, n2 = this.list.filter((t3) => Ce(e2, t3.offset, s2) || Ce(e2, t3.end, s2));
        if (n2.length > 0) {
          e2 = Math.min(e2, ...n2.map((e3) => e3.offset)), s2 = Math.max(s2, ...n2.map((e3) => e3.end)), t2 = s2 - e2;
          let i3 = n2.shift();
          i3.offset = e2, i3.length = t2, i3.end = s2, this.list = this.list.filter((e3) => !n2.includes(e3));
        } else
          this.list.push({ offset: e2, length: t2, end: s2 });
      }
      available(e2, t2) {
        let i2 = e2 + t2;
        return this.list.some((t3) => t3.offset <= e2 && i2 <= t3.end);
      }
    }
    function Ce(e2, t2, i2) {
      return e2 <= t2 && t2 <= i2;
    }
    class Pe extends Oe {
      constructor(t2, i2) {
        super(0), e(this, "chunksRead", 0), this.input = t2, this.options = i2;
      }
      async readWhole() {
        this.chunked = false, await this.readChunk(this.nextChunkOffset);
      }
      async readChunked() {
        this.chunked = true, await this.readChunk(0, this.options.firstChunkSize);
      }
      async readNextChunk(e2 = this.nextChunkOffset) {
        if (this.fullyRead)
          return this.chunksRead++, false;
        let t2 = this.options.chunkSize, i2 = await this.readChunk(e2, t2);
        return !!i2 && i2.byteLength === t2;
      }
      async readChunk(e2, t2) {
        if (this.chunksRead++, 0 !== (t2 = this.safeWrapAddress(e2, t2)))
          return this._readChunk(e2, t2);
      }
      safeWrapAddress(e2, t2) {
        return void 0 !== this.size && e2 + t2 > this.size ? Math.max(0, this.size - e2) : t2;
      }
      get nextChunkOffset() {
        if (0 !== this.ranges.list.length)
          return this.ranges.list[0].length;
      }
      get canReadNextChunk() {
        return this.chunksRead < this.options.chunkLimit;
      }
      get fullyRead() {
        return void 0 !== this.size && this.nextChunkOffset === this.size;
      }
      read() {
        return this.options.chunked ? this.readChunked() : this.readWhole();
      }
      close() {
      }
    }
    v.set("blob", class extends Pe {
      async readWhole() {
        this.chunked = false;
        let e2 = await U(this.input);
        this._swapArrayBuffer(e2);
      }
      readChunked() {
        return this.chunked = true, this.size = this.input.size, super.readChunked();
      }
      async _readChunk(e2, t2) {
        let i2 = t2 ? e2 + t2 : void 0, s2 = this.input.slice(e2, i2), n2 = await U(s2);
        return this.set(n2, e2, true);
      }
    });
    v.set("url", class extends Pe {
      async readWhole() {
        this.chunked = false;
        let e2 = await A(this.input);
        e2 instanceof ArrayBuffer ? this._swapArrayBuffer(e2) : e2 instanceof Uint8Array && this._swapBuffer(e2);
      }
      async _readChunk(e2, t2) {
        let i2 = t2 ? e2 + t2 - 1 : void 0, s2 = this.options.httpHeaders || {};
        (e2 || i2) && (s2.range = `bytes=${[e2, i2].join("-")}`);
        let n2 = await O(this.input, { headers: s2 }), r2 = await n2.arrayBuffer(), a2 = r2.byteLength;
        if (416 !== n2.status)
          return a2 !== t2 && (this.size = e2 + a2), this.set(r2, e2, true);
      }
    });
    y.prototype.getUint64 = function(e2) {
      let t2 = this.getUint32(e2), i2 = this.getUint32(e2 + 4);
      return t2 < 1048575 ? t2 << 32 | i2 : void 0 !== typeof a ? (console.warn("Using BigInt because of type 64uint but JS can only handle 53b numbers."), a(t2) << a(32) | a(i2)) : void u("Trying to read 64b value but JS can only handle 53b numbers.");
    };
    class Ue extends ee {
      parseBoxes(e2 = 0) {
        let t2 = [];
        for (; e2 < this.file.byteLength - 4; ) {
          let i2 = this.parseBoxHead(e2);
          if (t2.push(i2), 0 === i2.length)
            break;
          e2 += i2.length;
        }
        return t2;
      }
      parseSubBoxes(e2) {
        e2.boxes = this.parseBoxes(e2.start);
      }
      findBox(e2, t2) {
        return void 0 === e2.boxes && this.parseSubBoxes(e2), e2.boxes.find((e3) => e3.kind === t2);
      }
      parseBoxHead(e2) {
        let t2 = this.file.getUint32(e2), i2 = this.file.getString(e2 + 4, 4), s2 = e2 + 8;
        return 1 === t2 && (t2 = this.file.getUint64(e2 + 8), s2 += 8), { offset: e2, length: t2, kind: i2, start: s2 };
      }
      parseBoxFullHead(e2) {
        if (void 0 !== e2.version)
          return;
        let t2 = this.file.getUint32(e2.start);
        e2.version = t2 >> 24, e2.start += 4;
      }
    }
    class Ie extends Ue {
      static canHandle(e2, t2) {
        if (0 !== t2)
          return false;
        let i2 = e2.getUint16(2);
        if (i2 > 50)
          return false;
        let s2 = 16, n2 = [];
        for (; s2 < i2; )
          n2.push(e2.getString(s2, 4)), s2 += 4;
        return n2.includes(this.type);
      }
      async parse() {
        let e2 = this.file.getUint32(0), t2 = this.parseBoxHead(e2);
        for (; "meta" !== t2.kind; )
          e2 += t2.length, await this.file.ensureChunk(e2, 16), t2 = this.parseBoxHead(e2);
        await this.file.ensureChunk(t2.offset, t2.length), this.parseBoxFullHead(t2), this.parseSubBoxes(t2), this.options.icc.enabled && await this.findIcc(t2), this.options.tiff.enabled && await this.findExif(t2);
      }
      async registerSegment(e2, t2, i2) {
        await this.file.ensureChunk(t2, i2);
        let s2 = this.file.subarray(t2, i2);
        this.createParser(e2, s2);
      }
      async findIcc(e2) {
        let t2 = this.findBox(e2, "iprp");
        if (void 0 === t2)
          return;
        let i2 = this.findBox(t2, "ipco");
        if (void 0 === i2)
          return;
        let s2 = this.findBox(i2, "colr");
        void 0 !== s2 && await this.registerSegment("icc", s2.offset + 12, s2.length);
      }
      async findExif(e2) {
        let t2 = this.findBox(e2, "iinf");
        if (void 0 === t2)
          return;
        let i2 = this.findBox(e2, "iloc");
        if (void 0 === i2)
          return;
        let s2 = this.findExifLocIdInIinf(t2), n2 = this.findExtentInIloc(i2, s2);
        if (void 0 === n2)
          return;
        let [r2, a2] = n2;
        await this.file.ensureChunk(r2, a2);
        let o2 = 4 + this.file.getUint32(r2);
        r2 += o2, a2 -= o2, await this.registerSegment("tiff", r2, a2);
      }
      findExifLocIdInIinf(e2) {
        this.parseBoxFullHead(e2);
        let t2, i2, s2, n2, r2 = e2.start, a2 = this.file.getUint16(r2);
        for (r2 += 2; a2--; ) {
          if (t2 = this.parseBoxHead(r2), this.parseBoxFullHead(t2), i2 = t2.start, t2.version >= 2 && (s2 = 3 === t2.version ? 4 : 2, n2 = this.file.getString(i2 + s2 + 2, 4), "Exif" === n2))
            return this.file.getUintBytes(i2, s2);
          r2 += t2.length;
        }
      }
      get8bits(e2) {
        let t2 = this.file.getUint8(e2);
        return [t2 >> 4, 15 & t2];
      }
      findExtentInIloc(e2, t2) {
        this.parseBoxFullHead(e2);
        let i2 = e2.start, [s2, n2] = this.get8bits(i2++), [r2, a2] = this.get8bits(i2++), o2 = 2 === e2.version ? 4 : 2, h2 = 1 === e2.version || 2 === e2.version ? 2 : 0, l2 = a2 + s2 + n2, f2 = 2 === e2.version ? 4 : 2, u2 = this.file.getUintBytes(i2, f2);
        for (i2 += f2; u2--; ) {
          let e3 = this.file.getUintBytes(i2, o2);
          i2 += o2 + h2 + 2 + r2;
          let f3 = this.file.getUint16(i2);
          if (i2 += 2, e3 === t2)
            return f3 > 1 && console.warn("ILOC box has more than one extent but we're only processing one\nPlease create an issue at https://github.com/MikeKovarik/exifr with this file"), [this.file.getUintBytes(i2 + a2, s2), this.file.getUintBytes(i2 + a2 + s2, n2)];
          i2 += f3 * l2;
        }
      }
    }
    class Be extends Ie {
    }
    e(Be, "type", "heic");
    class Fe extends Ie {
    }
    e(Fe, "type", "avif"), S.set("heic", Be), S.set("avif", Fe), B(L, ["ifd0", "ifd1"], [[256, "ImageWidth"], [257, "ImageHeight"], [258, "BitsPerSample"], [259, "Compression"], [262, "PhotometricInterpretation"], [270, "ImageDescription"], [271, "Make"], [272, "Model"], [273, "StripOffsets"], [274, "Orientation"], [277, "SamplesPerPixel"], [278, "RowsPerStrip"], [279, "StripByteCounts"], [282, "XResolution"], [283, "YResolution"], [284, "PlanarConfiguration"], [296, "ResolutionUnit"], [301, "TransferFunction"], [305, "Software"], [306, "ModifyDate"], [315, "Artist"], [316, "HostComputer"], [317, "Predictor"], [318, "WhitePoint"], [319, "PrimaryChromaticities"], [513, "ThumbnailOffset"], [514, "ThumbnailLength"], [529, "YCbCrCoefficients"], [530, "YCbCrSubSampling"], [531, "YCbCrPositioning"], [532, "ReferenceBlackWhite"], [700, "ApplicationNotes"], [33432, "Copyright"], [33723, "IPTC"], [34665, "ExifIFD"], [34675, "ICC"], [34853, "GpsIFD"], [330, "SubIFD"], [40965, "InteropIFD"], [40091, "XPTitle"], [40092, "XPComment"], [40093, "XPAuthor"], [40094, "XPKeywords"], [40095, "XPSubject"]]), B(L, "exif", [[33434, "ExposureTime"], [33437, "FNumber"], [34850, "ExposureProgram"], [34852, "SpectralSensitivity"], [34855, "ISO"], [34858, "TimeZoneOffset"], [34859, "SelfTimerMode"], [34864, "SensitivityType"], [34865, "StandardOutputSensitivity"], [34866, "RecommendedExposureIndex"], [34867, "ISOSpeed"], [34868, "ISOSpeedLatitudeyyy"], [34869, "ISOSpeedLatitudezzz"], [36864, "ExifVersion"], [36867, "DateTimeOriginal"], [36868, "CreateDate"], [36873, "GooglePlusUploadCode"], [36880, "OffsetTime"], [36881, "OffsetTimeOriginal"], [36882, "OffsetTimeDigitized"], [37121, "ComponentsConfiguration"], [37122, "CompressedBitsPerPixel"], [37377, "ShutterSpeedValue"], [37378, "ApertureValue"], [37379, "BrightnessValue"], [37380, "ExposureCompensation"], [37381, "MaxApertureValue"], [37382, "SubjectDistance"], [37383, "MeteringMode"], [37384, "LightSource"], [37385, "Flash"], [37386, "FocalLength"], [37393, "ImageNumber"], [37394, "SecurityClassification"], [37395, "ImageHistory"], [37396, "SubjectArea"], [37500, "MakerNote"], [37510, "UserComment"], [37520, "SubSecTime"], [37521, "SubSecTimeOriginal"], [37522, "SubSecTimeDigitized"], [37888, "AmbientTemperature"], [37889, "Humidity"], [37890, "Pressure"], [37891, "WaterDepth"], [37892, "Acceleration"], [37893, "CameraElevationAngle"], [40960, "FlashpixVersion"], [40961, "ColorSpace"], [40962, "ExifImageWidth"], [40963, "ExifImageHeight"], [40964, "RelatedSoundFile"], [41483, "FlashEnergy"], [41486, "FocalPlaneXResolution"], [41487, "FocalPlaneYResolution"], [41488, "FocalPlaneResolutionUnit"], [41492, "SubjectLocation"], [41493, "ExposureIndex"], [41495, "SensingMethod"], [41728, "FileSource"], [41729, "SceneType"], [41730, "CFAPattern"], [41985, "CustomRendered"], [41986, "ExposureMode"], [41987, "WhiteBalance"], [41988, "DigitalZoomRatio"], [41989, "FocalLengthIn35mmFormat"], [41990, "SceneCaptureType"], [41991, "GainControl"], [41992, "Contrast"], [41993, "Saturation"], [41994, "Sharpness"], [41996, "SubjectDistanceRange"], [42016, "ImageUniqueID"], [42032, "OwnerName"], [42033, "SerialNumber"], [42034, "LensInfo"], [42035, "LensMake"], [42036, "LensModel"], [42037, "LensSerialNumber"], [42080, "CompositeImage"], [42081, "CompositeImageCount"], [42082, "CompositeImageExposureTimes"], [42240, "Gamma"], [59932, "Padding"], [59933, "OffsetSchema"], [65e3, "OwnerName"], [65001, "SerialNumber"], [65002, "Lens"], [65100, "RawFile"], [65101, "Converter"], [65102, "WhiteBalance"], [65105, "Exposure"], [65106, "Shadows"], [65107, "Brightness"], [65108, "Contrast"], [65109, "Saturation"], [65110, "Sharpness"], [65111, "Smoothness"], [65112, "MoireFilter"], [40965, "InteropIFD"]]), B(L, "gps", [[0, "GPSVersionID"], [1, "GPSLatitudeRef"], [2, "GPSLatitude"], [3, "GPSLongitudeRef"], [4, "GPSLongitude"], [5, "GPSAltitudeRef"], [6, "GPSAltitude"], [7, "GPSTimeStamp"], [8, "GPSSatellites"], [9, "GPSStatus"], [10, "GPSMeasureMode"], [11, "GPSDOP"], [12, "GPSSpeedRef"], [13, "GPSSpeed"], [14, "GPSTrackRef"], [15, "GPSTrack"], [16, "GPSImgDirectionRef"], [17, "GPSImgDirection"], [18, "GPSMapDatum"], [19, "GPSDestLatitudeRef"], [20, "GPSDestLatitude"], [21, "GPSDestLongitudeRef"], [22, "GPSDestLongitude"], [23, "GPSDestBearingRef"], [24, "GPSDestBearing"], [25, "GPSDestDistanceRef"], [26, "GPSDestDistance"], [27, "GPSProcessingMethod"], [28, "GPSAreaInformation"], [29, "GPSDateStamp"], [30, "GPSDifferential"], [31, "GPSHPositioningError"]]), B(D, ["ifd0", "ifd1"], [[274, { 1: "Horizontal (normal)", 2: "Mirror horizontal", 3: "Rotate 180", 4: "Mirror vertical", 5: "Mirror horizontal and rotate 270 CW", 6: "Rotate 90 CW", 7: "Mirror horizontal and rotate 90 CW", 8: "Rotate 270 CW" }], [296, { 1: "None", 2: "inches", 3: "cm" }]]);
    let Le = B(D, "exif", [[34850, { 0: "Not defined", 1: "Manual", 2: "Normal program", 3: "Aperture priority", 4: "Shutter priority", 5: "Creative program", 6: "Action program", 7: "Portrait mode", 8: "Landscape mode" }], [37121, { 0: "-", 1: "Y", 2: "Cb", 3: "Cr", 4: "R", 5: "G", 6: "B" }], [37383, { 0: "Unknown", 1: "Average", 2: "CenterWeightedAverage", 3: "Spot", 4: "MultiSpot", 5: "Pattern", 6: "Partial", 255: "Other" }], [37384, { 0: "Unknown", 1: "Daylight", 2: "Fluorescent", 3: "Tungsten (incandescent light)", 4: "Flash", 9: "Fine weather", 10: "Cloudy weather", 11: "Shade", 12: "Daylight fluorescent (D 5700 - 7100K)", 13: "Day white fluorescent (N 4600 - 5400K)", 14: "Cool white fluorescent (W 3900 - 4500K)", 15: "White fluorescent (WW 3200 - 3700K)", 17: "Standard light A", 18: "Standard light B", 19: "Standard light C", 20: "D55", 21: "D65", 22: "D75", 23: "D50", 24: "ISO studio tungsten", 255: "Other" }], [37385, { 0: "Flash did not fire", 1: "Flash fired", 5: "Strobe return light not detected", 7: "Strobe return light detected", 9: "Flash fired, compulsory flash mode", 13: "Flash fired, compulsory flash mode, return light not detected", 15: "Flash fired, compulsory flash mode, return light detected", 16: "Flash did not fire, compulsory flash mode", 24: "Flash did not fire, auto mode", 25: "Flash fired, auto mode", 29: "Flash fired, auto mode, return light not detected", 31: "Flash fired, auto mode, return light detected", 32: "No flash function", 65: "Flash fired, red-eye reduction mode", 69: "Flash fired, red-eye reduction mode, return light not detected", 71: "Flash fired, red-eye reduction mode, return light detected", 73: "Flash fired, compulsory flash mode, red-eye reduction mode", 77: "Flash fired, compulsory flash mode, red-eye reduction mode, return light not detected", 79: "Flash fired, compulsory flash mode, red-eye reduction mode, return light detected", 89: "Flash fired, auto mode, red-eye reduction mode", 93: "Flash fired, auto mode, return light not detected, red-eye reduction mode", 95: "Flash fired, auto mode, return light detected, red-eye reduction mode" }], [41495, { 1: "Not defined", 2: "One-chip color area sensor", 3: "Two-chip color area sensor", 4: "Three-chip color area sensor", 5: "Color sequential area sensor", 7: "Trilinear sensor", 8: "Color sequential linear sensor" }], [41728, { 1: "Film Scanner", 2: "Reflection Print Scanner", 3: "Digital Camera" }], [41729, { 1: "Directly photographed" }], [41985, { 0: "Normal", 1: "Custom", 2: "HDR (no original saved)", 3: "HDR (original saved)", 4: "Original (for HDR)", 6: "Panorama", 7: "Portrait HDR", 8: "Portrait" }], [41986, { 0: "Auto", 1: "Manual", 2: "Auto bracket" }], [41987, { 0: "Auto", 1: "Manual" }], [41990, { 0: "Standard", 1: "Landscape", 2: "Portrait", 3: "Night", 4: "Other" }], [41991, { 0: "None", 1: "Low gain up", 2: "High gain up", 3: "Low gain down", 4: "High gain down" }], [41996, { 0: "Unknown", 1: "Macro", 2: "Close", 3: "Distant" }], [42080, { 0: "Unknown", 1: "Not a Composite Image", 2: "General Composite Image", 3: "Composite Image Captured While Shooting" }]]);
    const De = { 1: "No absolute unit of measurement", 2: "Inch", 3: "Centimeter" };
    Le.set(37392, De), Le.set(41488, De);
    const Te = { 0: "Normal", 1: "Low", 2: "High" };
    function ze(e2) {
      return "object" == typeof e2 && void 0 !== e2.length ? e2[0] : e2;
    }
    function Ne(e2) {
      let t2 = Array.from(e2).slice(1);
      return t2[1] > 15 && (t2 = t2.map((e3) => String.fromCharCode(e3))), "0" !== t2[2] && 0 !== t2[2] || t2.pop(), t2.join(".");
    }
    function Ve(e2) {
      if ("string" == typeof e2) {
        var [t2, i2, s2, n2, r2, a2] = e2.trim().split(/[-: ]/g).map(Number), o2 = new Date(t2, i2 - 1, s2);
        return Number.isNaN(n2) || Number.isNaN(r2) || Number.isNaN(a2) || (o2.setHours(n2), o2.setMinutes(r2), o2.setSeconds(a2)), Number.isNaN(+o2) ? e2 : o2;
      }
    }
    function Me(e2) {
      if ("string" == typeof e2)
        return e2;
      let t2 = [];
      if (0 === e2[1] && 0 === e2[e2.length - 1])
        for (let i2 = 0; i2 < e2.length; i2 += 2)
          t2.push(Ee(e2[i2 + 1], e2[i2]));
      else
        for (let i2 = 0; i2 < e2.length; i2 += 2)
          t2.push(Ee(e2[i2], e2[i2 + 1]));
      return d(String.fromCodePoint(...t2));
    }
    function Ee(e2, t2) {
      return e2 << 8 | t2;
    }
    Le.set(41992, Te), Le.set(41993, Te), Le.set(41994, Te), B(T, ["ifd0", "ifd1"], [[50827, function(e2) {
      return "string" != typeof e2 ? m(e2) : e2;
    }], [306, Ve], [40091, Me], [40092, Me], [40093, Me], [40094, Me], [40095, Me]]), B(T, "exif", [[40960, Ne], [36864, Ne], [36867, Ve], [36868, Ve], [40962, ze], [40963, ze]]), B(T, "gps", [[0, (e2) => Array.from(e2).join(".")], [7, (e2) => Array.from(e2).join(":")]]);
    class Re extends te {
      static canHandle(e2, t2) {
        return 225 === e2.getUint8(t2 + 1) && 1752462448 === e2.getUint32(t2 + 4) && "http://ns.adobe.com/" === e2.getString(t2 + 4, "http://ns.adobe.com/".length);
      }
      static headerLength(e2, t2) {
        return "http://ns.adobe.com/xmp/extension/" === e2.getString(t2 + 4, "http://ns.adobe.com/xmp/extension/".length) ? 79 : 4 + "http://ns.adobe.com/xap/1.0/".length + 1;
      }
      static findPosition(e2, t2) {
        let i2 = super.findPosition(e2, t2);
        return i2.multiSegment = i2.extended = 79 === i2.headerLength, i2.multiSegment ? (i2.chunkCount = e2.getUint8(t2 + 72), i2.chunkNumber = e2.getUint8(t2 + 76), 0 !== e2.getUint8(t2 + 77) && i2.chunkNumber++) : (i2.chunkCount = 1 / 0, i2.chunkNumber = -1), i2;
      }
      static handleMultiSegments(e2) {
        return e2.map((e3) => e3.chunk.getString()).join("");
      }
      normalizeInput(e2) {
        return "string" == typeof e2 ? e2 : y.from(e2).getString();
      }
      parse(e2 = this.chunk) {
        if (!this.localOptions.parse)
          return e2;
        e2 = function(e3) {
          let t3 = {}, i3 = {};
          for (let e4 of Ye)
            t3[e4] = [], i3[e4] = 0;
          return e3.replace(qe, (e4, s3, n2) => {
            if ("<" === s3) {
              let s4 = ++i3[n2];
              return t3[n2].push(s4), `${e4}#${s4}`;
            }
            return `${e4}#${t3[n2].pop()}`;
          });
        }(e2);
        let t2 = Ge.findAll(e2, "rdf", "Description");
        0 === t2.length && t2.push(new Ge("rdf", "Description", void 0, e2));
        let i2, s2 = {};
        for (let e3 of t2)
          for (let t3 of e3.properties)
            i2 = $e(t3.ns, s2), He(t3, i2);
        return function(e3) {
          let t3;
          for (let i3 in e3)
            t3 = e3[i3] = h(e3[i3]), void 0 === t3 && delete e3[i3];
          return h(e3);
        }(s2);
      }
      assignToOutput(e2, t2) {
        if (this.localOptions.parse)
          for (let [i2, s2] of Object.entries(t2))
            switch (i2) {
              case "tiff":
                this.assignObjectToOutput(e2, "ifd0", s2);
                break;
              case "exif":
                this.assignObjectToOutput(e2, "exif", s2);
                break;
              case "xmlns":
                break;
              default:
                this.assignObjectToOutput(e2, i2, s2);
            }
        else
          e2.xmp = t2;
      }
    }
    e(Re, "type", "xmp"), e(Re, "multiSegment", true), k.set("xmp", Re);
    class je {
      static findAll(e2) {
        return Ke(e2, /([a-zA-Z0-9-]+):([a-zA-Z0-9-]+)=("[^"]*"|'[^']*')/gm).map(je.unpackMatch);
      }
      static unpackMatch(e2) {
        let t2 = e2[1], i2 = e2[2], s2 = e2[3].slice(1, -1);
        return s2 = Xe(s2), new je(t2, i2, s2);
      }
      constructor(e2, t2, i2) {
        this.ns = e2, this.name = t2, this.value = i2;
      }
      serialize() {
        return this.value;
      }
    }
    class Ge {
      static findAll(e2, t2, i2) {
        if (void 0 !== t2 || void 0 !== i2) {
          t2 = t2 || "[\\w\\d-]+", i2 = i2 || "[\\w\\d-]+";
          var s2 = new RegExp(`<(${t2}):(${i2})(#\\d+)?((\\s+?[\\w\\d-:]+=("[^"]*"|'[^']*'))*\\s*)(\\/>|>([\\s\\S]*?)<\\/\\1:\\2\\3>)`, "gm");
        } else
          s2 = /<([\w\d-]+):([\w\d-]+)(#\d+)?((\s+?[\w\d-:]+=("[^"]*"|'[^']*'))*\s*)(\/>|>([\s\S]*?)<\/\1:\2\3>)/gm;
        return Ke(e2, s2).map(Ge.unpackMatch);
      }
      static unpackMatch(e2) {
        let t2 = e2[1], i2 = e2[2], s2 = e2[4], n2 = e2[8];
        return new Ge(t2, i2, s2, n2);
      }
      constructor(e2, t2, i2, s2) {
        this.ns = e2, this.name = t2, this.attrString = i2, this.innerXml = s2, this.attrs = je.findAll(i2), this.children = Ge.findAll(s2), this.value = 0 === this.children.length ? Xe(s2) : void 0, this.properties = [...this.attrs, ...this.children];
      }
      get isPrimitive() {
        return void 0 !== this.value && 0 === this.attrs.length && 0 === this.children.length;
      }
      get isListContainer() {
        return 1 === this.children.length && this.children[0].isList;
      }
      get isList() {
        let { ns: e2, name: t2 } = this;
        return "rdf" === e2 && ("Seq" === t2 || "Bag" === t2 || "Alt" === t2);
      }
      get isListItem() {
        return "rdf" === this.ns && "li" === this.name;
      }
      serialize() {
        if (0 === this.properties.length && void 0 === this.value)
          return;
        if (this.isPrimitive)
          return this.value;
        if (this.isListContainer)
          return this.children[0].serialize();
        if (this.isList)
          return We(this.children.map(_e));
        if (this.isListItem && 1 === this.children.length && 0 === this.attrs.length)
          return this.children[0].serialize();
        let e2 = {};
        for (let t2 of this.properties)
          He(t2, e2);
        return void 0 !== this.value && (e2.value = this.value), h(e2);
      }
    }
    function He(e2, t2) {
      let i2 = e2.serialize();
      void 0 !== i2 && (t2[e2.name] = i2);
    }
    var _e = (e2) => e2.serialize(), We = (e2) => 1 === e2.length ? e2[0] : e2, $e = (e2, t2) => t2[e2] ? t2[e2] : t2[e2] = {};
    function Ke(e2, t2) {
      let i2, s2 = [];
      if (!e2)
        return s2;
      for (; null !== (i2 = t2.exec(e2)); )
        s2.push(i2);
      return s2;
    }
    function Xe(e2) {
      if (function(e3) {
        return null == e3 || "null" === e3 || "undefined" === e3 || "" === e3 || "" === e3.trim();
      }(e2))
        return;
      let t2 = Number(e2);
      if (!Number.isNaN(t2))
        return t2;
      let i2 = e2.toLowerCase();
      return "true" === i2 || "false" !== i2 && e2.trim();
    }
    const Ye = ["rdf:li", "rdf:Seq", "rdf:Bag", "rdf:Alt", "rdf:Description"], qe = new RegExp(`(<|\\/)(${Ye.join("|")})`, "g");
    const defaultOptions2 = {
      maxRequests: 6
    };
    class RequestScheduler {
      constructor(options) {
        this.options = {
          ...defaultOptions2,
          ...options
        };
        this.requestQueue = [];
        this.executing = /* @__PURE__ */ new Set();
      }
      remove(p2) {
        this.executing.delete(p2);
        if (!p2.cancelled) {
          p2.completed = true;
          this.enqueue();
        }
      }
      enqueue() {
        for (let numImageRequests = this.executing.size; numImageRequests < this.options.maxRequests && this.requestQueue.length > 0; numImageRequests++) {
          const q2 = this.requestQueue.shift();
          if (q2.cancelled) {
            this.remove(q2);
            continue;
          }
          const p2 = Promise.resolve().then(() => {
            const request2 = q2.ref();
            q2.request = request2;
            return request2;
          });
          this.executing.add(q2);
          p2.then(() => {
            this.remove(q2);
          }).catch(() => {
            this.remove(q2);
          });
        }
      }
      scheduleRequest(fn) {
        const request2 = {
          ref: fn,
          cancelled: false,
          completed: false,
          request: null,
          cancel: () => {
            if (!request2.completed && !request2.cancelled) {
              request2.cancelled = true;
              if (request2.request) {
                request2.request.cancel();
              }
              this.enqueue();
            }
          }
        };
        this.requestQueue.push(request2);
        this.enqueue();
        return request2;
      }
    }
    var _bin = {
      nextZero: function(data, p2) {
        while (data[p2] != 0)
          p2++;
        return p2;
      },
      readUshort: function(buff, p2) {
        return buff[p2] << 8 | buff[p2 + 1];
      },
      writeUshort: function(buff, p2, n2) {
        buff[p2] = n2 >> 8 & 255;
        buff[p2 + 1] = n2 & 255;
      },
      readUint: function(buff, p2) {
        return buff[p2] * (256 * 256 * 256) + (buff[p2 + 1] << 16 | buff[p2 + 2] << 8 | buff[p2 + 3]);
      },
      writeUint: function(buff, p2, n2) {
        buff[p2] = n2 >> 24 & 255;
        buff[p2 + 1] = n2 >> 16 & 255;
        buff[p2 + 2] = n2 >> 8 & 255;
        buff[p2 + 3] = n2 & 255;
      },
      readASCII: function(buff, p2, l2) {
        var s2 = "";
        for (var i2 = 0; i2 < l2; i2++)
          s2 += String.fromCharCode(buff[p2 + i2]);
        return s2;
      },
      writeASCII: function(data, p2, s2) {
        for (var i2 = 0; i2 < s2.length; i2++)
          data[p2 + i2] = s2.charCodeAt(i2);
      },
      readBytes: function(buff, p2, l2) {
        var arr = [];
        for (var i2 = 0; i2 < l2; i2++)
          arr.push(buff[p2 + i2]);
        return arr;
      },
      pad: function(n2) {
        return n2.length < 2 ? "0" + n2 : n2;
      },
      readUTF8: function(buff, p2, l2) {
        var s2 = "", ns;
        for (var i2 = 0; i2 < l2; i2++)
          s2 += "%" + _bin.pad(buff[p2 + i2].toString(16));
        try {
          ns = decodeURIComponent(s2);
        } catch (e2) {
          return _bin.readASCII(buff, p2, l2);
        }
        return ns;
      }
    };
    function toRGBA8(out) {
      var w2 = out.width, h2 = out.height;
      if (out.tabs.acTL == null)
        return [decodeImage(out.data, w2, h2, out).buffer];
      var frms = [];
      if (out.frames[0].data == null)
        out.frames[0].data = out.data;
      var len = w2 * h2 * 4, img = new Uint8Array(len), empty = new Uint8Array(len), prev = new Uint8Array(len);
      for (var i2 = 0; i2 < out.frames.length; i2++) {
        var frm = out.frames[i2];
        var fx = frm.rect.x, fy = frm.rect.y, fw = frm.rect.width, fh = frm.rect.height;
        var fdata = decodeImage(frm.data, fw, fh, out);
        if (i2 != 0)
          for (var j2 = 0; j2 < len; j2++)
            prev[j2] = img[j2];
        if (frm.blend == 0)
          _copyTile(fdata, fw, fh, img, w2, h2, fx, fy, 0);
        else if (frm.blend == 1)
          _copyTile(fdata, fw, fh, img, w2, h2, fx, fy, 1);
        frms.push(img.buffer.slice(0));
        if (frm.dispose == 0)
          ;
        else if (frm.dispose == 1)
          _copyTile(empty, fw, fh, img, w2, h2, fx, fy, 0);
        else if (frm.dispose == 2)
          for (var j2 = 0; j2 < len; j2++)
            img[j2] = prev[j2];
      }
      return frms;
    }
    function decodeImage(data, w2, h2, out) {
      var area = w2 * h2, bpp = _getBPP(out);
      var bpl = Math.ceil(w2 * bpp / 8);
      var bf = new Uint8Array(area * 4), bf32 = new Uint32Array(bf.buffer);
      var ctype = out.ctype, depth = out.depth;
      var rs = _bin.readUshort;
      if (ctype == 6) {
        var qarea = area << 2;
        if (depth == 8)
          for (var i2 = 0; i2 < qarea; i2 += 4) {
            bf[i2] = data[i2];
            bf[i2 + 1] = data[i2 + 1];
            bf[i2 + 2] = data[i2 + 2];
            bf[i2 + 3] = data[i2 + 3];
          }
        if (depth == 16)
          for (var i2 = 0; i2 < qarea; i2++) {
            bf[i2] = data[i2 << 1];
          }
      } else if (ctype == 2) {
        var ts = out.tabs["tRNS"];
        if (ts == null) {
          if (depth == 8)
            for (var i2 = 0; i2 < area; i2++) {
              var ti = i2 * 3;
              bf32[i2] = 255 << 24 | data[ti + 2] << 16 | data[ti + 1] << 8 | data[ti];
            }
          if (depth == 16)
            for (var i2 = 0; i2 < area; i2++) {
              var ti = i2 * 6;
              bf32[i2] = 255 << 24 | data[ti + 4] << 16 | data[ti + 2] << 8 | data[ti];
            }
        } else {
          var tr = ts[0], tg = ts[1], tb = ts[2];
          if (depth == 8)
            for (var i2 = 0; i2 < area; i2++) {
              var qi = i2 << 2, ti = i2 * 3;
              bf32[i2] = 255 << 24 | data[ti + 2] << 16 | data[ti + 1] << 8 | data[ti];
              if (data[ti] == tr && data[ti + 1] == tg && data[ti + 2] == tb)
                bf[qi + 3] = 0;
            }
          if (depth == 16)
            for (var i2 = 0; i2 < area; i2++) {
              var qi = i2 << 2, ti = i2 * 6;
              bf32[i2] = 255 << 24 | data[ti + 4] << 16 | data[ti + 2] << 8 | data[ti];
              if (rs(data, ti) == tr && rs(data, ti + 2) == tg && rs(data, ti + 4) == tb)
                bf[qi + 3] = 0;
            }
        }
      } else if (ctype == 3) {
        var p2 = out.tabs["PLTE"], ap = out.tabs["tRNS"], tl = ap ? ap.length : 0;
        if (depth == 1)
          for (var y2 = 0; y2 < h2; y2++) {
            var s0 = y2 * bpl, t0 = y2 * w2;
            for (var i2 = 0; i2 < w2; i2++) {
              var qi = t0 + i2 << 2, j2 = data[s0 + (i2 >> 3)] >> 7 - ((i2 & 7) << 0) & 1, cj = 3 * j2;
              bf[qi] = p2[cj];
              bf[qi + 1] = p2[cj + 1];
              bf[qi + 2] = p2[cj + 2];
              bf[qi + 3] = j2 < tl ? ap[j2] : 255;
            }
          }
        if (depth == 2)
          for (var y2 = 0; y2 < h2; y2++) {
            var s0 = y2 * bpl, t0 = y2 * w2;
            for (var i2 = 0; i2 < w2; i2++) {
              var qi = t0 + i2 << 2, j2 = data[s0 + (i2 >> 2)] >> 6 - ((i2 & 3) << 1) & 3, cj = 3 * j2;
              bf[qi] = p2[cj];
              bf[qi + 1] = p2[cj + 1];
              bf[qi + 2] = p2[cj + 2];
              bf[qi + 3] = j2 < tl ? ap[j2] : 255;
            }
          }
        if (depth == 4)
          for (var y2 = 0; y2 < h2; y2++) {
            var s0 = y2 * bpl, t0 = y2 * w2;
            for (var i2 = 0; i2 < w2; i2++) {
              var qi = t0 + i2 << 2, j2 = data[s0 + (i2 >> 1)] >> 4 - ((i2 & 1) << 2) & 15, cj = 3 * j2;
              bf[qi] = p2[cj];
              bf[qi + 1] = p2[cj + 1];
              bf[qi + 2] = p2[cj + 2];
              bf[qi + 3] = j2 < tl ? ap[j2] : 255;
            }
          }
        if (depth == 8)
          for (var i2 = 0; i2 < area; i2++) {
            var qi = i2 << 2, j2 = data[i2], cj = 3 * j2;
            bf[qi] = p2[cj];
            bf[qi + 1] = p2[cj + 1];
            bf[qi + 2] = p2[cj + 2];
            bf[qi + 3] = j2 < tl ? ap[j2] : 255;
          }
      } else if (ctype == 4) {
        if (depth == 8)
          for (var i2 = 0; i2 < area; i2++) {
            var qi = i2 << 2, di = i2 << 1, gr = data[di];
            bf[qi] = gr;
            bf[qi + 1] = gr;
            bf[qi + 2] = gr;
            bf[qi + 3] = data[di + 1];
          }
        if (depth == 16)
          for (var i2 = 0; i2 < area; i2++) {
            var qi = i2 << 2, di = i2 << 2, gr = data[di];
            bf[qi] = gr;
            bf[qi + 1] = gr;
            bf[qi + 2] = gr;
            bf[qi + 3] = data[di + 2];
          }
      } else if (ctype == 0) {
        var tr = out.tabs["tRNS"] ? out.tabs["tRNS"] : -1;
        for (var y2 = 0; y2 < h2; y2++) {
          var off = y2 * bpl, to = y2 * w2;
          if (depth == 1)
            for (var x2 = 0; x2 < w2; x2++) {
              var gr = 255 * (data[off + (x2 >>> 3)] >>> 7 - (x2 & 7) & 1), al = gr == tr * 255 ? 0 : 255;
              bf32[to + x2] = al << 24 | gr << 16 | gr << 8 | gr;
            }
          else if (depth == 2)
            for (var x2 = 0; x2 < w2; x2++) {
              var gr = 85 * (data[off + (x2 >>> 2)] >>> 6 - ((x2 & 3) << 1) & 3), al = gr == tr * 85 ? 0 : 255;
              bf32[to + x2] = al << 24 | gr << 16 | gr << 8 | gr;
            }
          else if (depth == 4)
            for (var x2 = 0; x2 < w2; x2++) {
              var gr = 17 * (data[off + (x2 >>> 1)] >>> 4 - ((x2 & 1) << 2) & 15), al = gr == tr * 17 ? 0 : 255;
              bf32[to + x2] = al << 24 | gr << 16 | gr << 8 | gr;
            }
          else if (depth == 8)
            for (var x2 = 0; x2 < w2; x2++) {
              var gr = data[off + x2], al = gr == tr ? 0 : 255;
              bf32[to + x2] = al << 24 | gr << 16 | gr << 8 | gr;
            }
          else if (depth == 16)
            for (var x2 = 0; x2 < w2; x2++) {
              var gr = data[off + (x2 << 1)], al = rs(data, off + (x2 << 1)) == tr ? 0 : 255;
              bf32[to + x2] = al << 24 | gr << 16 | gr << 8 | gr;
            }
        }
      }
      return bf;
    }
    function decode2(buff) {
      var data = new Uint8Array(buff), offset = 8, bin = _bin, rUs = bin.readUshort, rUi = bin.readUint;
      var out = { tabs: {}, frames: [] };
      var dd = new Uint8Array(data.length), doff = 0;
      var fd, foff = 0;
      var mgck = [137, 80, 78, 71, 13, 10, 26, 10];
      for (var i2 = 0; i2 < 8; i2++)
        if (data[i2] != mgck[i2])
          throw "The input is not a PNG file!";
      while (offset < data.length) {
        var len = bin.readUint(data, offset);
        offset += 4;
        var type = bin.readASCII(data, offset, 4);
        offset += 4;
        if (type == "IHDR") {
          _IHDR(data, offset, out);
        } else if (type == "iCCP") {
          var off = offset;
          while (data[off] != 0)
            off++;
          bin.readASCII(data, offset, off - offset);
          data[off + 1];
          var fil = data.slice(off + 2, offset + len);
          var res = null;
          try {
            res = _inflate(fil);
          } catch (e2) {
            res = inflateRaw(fil);
          }
          out.tabs[type] = res;
        } else if (type == "CgBI") {
          out.tabs[type] = data.slice(offset, offset + 4);
        } else if (type == "IDAT") {
          for (var i2 = 0; i2 < len; i2++)
            dd[doff + i2] = data[offset + i2];
          doff += len;
        } else if (type == "acTL") {
          out.tabs[type] = { num_frames: rUi(data, offset), num_plays: rUi(data, offset + 4) };
          fd = new Uint8Array(data.length);
        } else if (type == "fcTL") {
          if (foff != 0) {
            var fr = out.frames[out.frames.length - 1];
            fr.data = _decompress(out, fd.slice(0, foff), fr.rect.width, fr.rect.height);
            foff = 0;
          }
          var rct = { x: rUi(data, offset + 12), y: rUi(data, offset + 16), width: rUi(data, offset + 4), height: rUi(data, offset + 8) };
          var del = rUs(data, offset + 22);
          del = rUs(data, offset + 20) / (del == 0 ? 100 : del);
          var frm = { rect: rct, delay: Math.round(del * 1e3), dispose: data[offset + 24], blend: data[offset + 25] };
          out.frames.push(frm);
        } else if (type == "fdAT") {
          for (var i2 = 0; i2 < len - 4; i2++)
            fd[foff + i2] = data[offset + i2 + 4];
          foff += len - 4;
        } else if (type == "pHYs") {
          out.tabs[type] = [bin.readUint(data, offset), bin.readUint(data, offset + 4), data[offset + 8]];
        } else if (type == "cHRM") {
          out.tabs[type] = [];
          for (var i2 = 0; i2 < 8; i2++)
            out.tabs[type].push(bin.readUint(data, offset + i2 * 4));
        } else if (type == "tEXt" || type == "zTXt") {
          if (out.tabs[type] == null)
            out.tabs[type] = {};
          var nz = bin.nextZero(data, offset);
          var keyw = bin.readASCII(data, offset, nz - offset);
          var text, tl = offset + len - nz - 1;
          if (type == "tEXt")
            text = bin.readASCII(data, nz + 1, tl);
          else {
            var bfr = _inflate(data.slice(nz + 2, nz + 2 + tl));
            text = bin.readUTF8(bfr, 0, bfr.length);
          }
          out.tabs[type][keyw] = text;
        } else if (type == "iTXt") {
          if (out.tabs[type] == null)
            out.tabs[type] = {};
          var nz = 0, off = offset;
          nz = bin.nextZero(data, off);
          var keyw = bin.readASCII(data, off, nz - off);
          off = nz + 1;
          var cflag = data[off];
          data[off + 1];
          off += 2;
          nz = bin.nextZero(data, off);
          bin.readASCII(data, off, nz - off);
          off = nz + 1;
          nz = bin.nextZero(data, off);
          bin.readUTF8(data, off, nz - off);
          off = nz + 1;
          var text, tl = len - (off - offset);
          if (cflag == 0)
            text = bin.readUTF8(data, off, tl);
          else {
            var bfr = _inflate(data.slice(off, off + tl));
            text = bin.readUTF8(bfr, 0, bfr.length);
          }
          out.tabs[type][keyw] = text;
        } else if (type == "PLTE") {
          out.tabs[type] = bin.readBytes(data, offset, len);
        } else if (type == "hIST") {
          var pl = out.tabs["PLTE"].length / 3;
          out.tabs[type] = [];
          for (var i2 = 0; i2 < pl; i2++)
            out.tabs[type].push(rUs(data, offset + i2 * 2));
        } else if (type == "tRNS") {
          if (out.ctype == 3)
            out.tabs[type] = bin.readBytes(data, offset, len);
          else if (out.ctype == 0)
            out.tabs[type] = rUs(data, offset);
          else if (out.ctype == 2)
            out.tabs[type] = [rUs(data, offset), rUs(data, offset + 2), rUs(data, offset + 4)];
        } else if (type == "gAMA")
          out.tabs[type] = bin.readUint(data, offset) / 1e5;
        else if (type == "sRGB")
          out.tabs[type] = data[offset];
        else if (type == "bKGD") {
          if (out.ctype == 0 || out.ctype == 4)
            out.tabs[type] = [rUs(data, offset)];
          else if (out.ctype == 2 || out.ctype == 6)
            out.tabs[type] = [rUs(data, offset), rUs(data, offset + 2), rUs(data, offset + 4)];
          else if (out.ctype == 3)
            out.tabs[type] = data[offset];
        } else if (type == "IEND") {
          break;
        }
        offset += len;
        bin.readUint(data, offset);
        offset += 4;
      }
      if (foff != 0) {
        var fr = out.frames[out.frames.length - 1];
        fr.data = _decompress(out, fd.slice(0, foff), fr.rect.width, fr.rect.height);
      }
      out.data = _decompress(out, dd, out.width, out.height);
      delete out.compress;
      delete out.interlace;
      delete out.filter;
      return out;
    }
    function _decompress(out, dd, w2, h2) {
      var bpp = _getBPP(out), bpl = Math.ceil(w2 * bpp / 8), buff = new Uint8Array((bpl + 1 + out.interlace) * h2);
      if (out.tabs["CgBI"])
        dd = inflateRaw(dd, buff);
      else
        dd = _inflate(dd, buff);
      if (out.interlace == 0)
        dd = _filterZero(dd, out, 0, w2, h2);
      else if (out.interlace == 1)
        dd = _readInterlace(dd, out);
      return dd;
    }
    function _inflate(data, buff) {
      var out = inflateRaw(new Uint8Array(data.buffer, 2, data.length - 6), buff);
      return out;
    }
    var inflateRaw = function() {
      var H2 = {};
      H2.H = {};
      H2.H.N = function(N2, W2) {
        var R2 = Uint8Array, i2 = 0, m2 = 0, J2 = 0, h2 = 0, Q2 = 0, X2 = 0, u2 = 0, w2 = 0, d2 = 0, v2, C2;
        if (N2[0] == 3 && N2[1] == 0)
          return W2 ? W2 : new R2(0);
        var V2 = H2.H, n2 = V2.b, A2 = V2.e, l2 = V2.R, M2 = V2.n, I2 = V2.A, e2 = V2.Z, b2 = V2.m, Z2 = W2 == null;
        if (Z2)
          W2 = new R2(N2.length >>> 2 << 5);
        while (i2 == 0) {
          i2 = n2(N2, d2, 1);
          m2 = n2(N2, d2 + 1, 2);
          d2 += 3;
          if (m2 == 0) {
            if ((d2 & 7) != 0)
              d2 += 8 - (d2 & 7);
            var D2 = (d2 >>> 3) + 4, q2 = N2[D2 - 4] | N2[D2 - 3] << 8;
            if (Z2)
              W2 = H2.H.W(W2, w2 + q2);
            W2.set(new R2(N2.buffer, N2.byteOffset + D2, q2), w2);
            d2 = D2 + q2 << 3;
            w2 += q2;
            continue;
          }
          if (Z2)
            W2 = H2.H.W(W2, w2 + (1 << 17));
          if (m2 == 1) {
            v2 = b2.J;
            C2 = b2.h;
            X2 = (1 << 9) - 1;
            u2 = (1 << 5) - 1;
          }
          if (m2 == 2) {
            J2 = A2(N2, d2, 5) + 257;
            h2 = A2(N2, d2 + 5, 5) + 1;
            Q2 = A2(N2, d2 + 10, 4) + 4;
            d2 += 14;
            var j2 = 1;
            for (var c2 = 0; c2 < 38; c2 += 2) {
              b2.Q[c2] = 0;
              b2.Q[c2 + 1] = 0;
            }
            for (var c2 = 0; c2 < Q2; c2++) {
              var K2 = A2(N2, d2 + c2 * 3, 3);
              b2.Q[(b2.X[c2] << 1) + 1] = K2;
              if (K2 > j2)
                j2 = K2;
            }
            d2 += 3 * Q2;
            M2(b2.Q, j2);
            I2(b2.Q, j2, b2.u);
            v2 = b2.w;
            C2 = b2.d;
            d2 = l2(b2.u, (1 << j2) - 1, J2 + h2, N2, d2, b2.v);
            var r2 = V2.V(b2.v, 0, J2, b2.C);
            X2 = (1 << r2) - 1;
            var S2 = V2.V(b2.v, J2, h2, b2.D);
            u2 = (1 << S2) - 1;
            M2(b2.C, r2);
            I2(b2.C, r2, v2);
            M2(b2.D, S2);
            I2(b2.D, S2, C2);
          }
          while (true) {
            var T2 = v2[e2(N2, d2) & X2];
            d2 += T2 & 15;
            var p2 = T2 >>> 4;
            if (p2 >>> 8 == 0) {
              W2[w2++] = p2;
            } else if (p2 == 256) {
              break;
            } else {
              var z2 = w2 + p2 - 254;
              if (p2 > 264) {
                var _2 = b2.q[p2 - 257];
                z2 = w2 + (_2 >>> 3) + A2(N2, d2, _2 & 7);
                d2 += _2 & 7;
              }
              var $2 = C2[e2(N2, d2) & u2];
              d2 += $2 & 15;
              var s2 = $2 >>> 4, Y2 = b2.c[s2], a2 = (Y2 >>> 4) + n2(N2, d2, Y2 & 15);
              d2 += Y2 & 15;
              while (w2 < z2) {
                W2[w2] = W2[w2++ - a2];
                W2[w2] = W2[w2++ - a2];
                W2[w2] = W2[w2++ - a2];
                W2[w2] = W2[w2++ - a2];
              }
              w2 = z2;
            }
          }
        }
        return W2.length == w2 ? W2 : W2.slice(0, w2);
      };
      H2.H.W = function(N2, W2) {
        var R2 = N2.length;
        if (W2 <= R2)
          return N2;
        var V2 = new Uint8Array(R2 << 1);
        V2.set(N2, 0);
        return V2;
      };
      H2.H.R = function(N2, W2, R2, V2, n2, A2) {
        var l2 = H2.H.e, M2 = H2.H.Z, I2 = 0;
        while (I2 < R2) {
          var e2 = N2[M2(V2, n2) & W2];
          n2 += e2 & 15;
          var b2 = e2 >>> 4;
          if (b2 <= 15) {
            A2[I2] = b2;
            I2++;
          } else {
            var Z2 = 0, m2 = 0;
            if (b2 == 16) {
              m2 = 3 + l2(V2, n2, 2);
              n2 += 2;
              Z2 = A2[I2 - 1];
            } else if (b2 == 17) {
              m2 = 3 + l2(V2, n2, 3);
              n2 += 3;
            } else if (b2 == 18) {
              m2 = 11 + l2(V2, n2, 7);
              n2 += 7;
            }
            var J2 = I2 + m2;
            while (I2 < J2) {
              A2[I2] = Z2;
              I2++;
            }
          }
        }
        return n2;
      };
      H2.H.V = function(N2, W2, R2, V2) {
        var n2 = 0, A2 = 0, l2 = V2.length >>> 1;
        while (A2 < R2) {
          var M2 = N2[A2 + W2];
          V2[A2 << 1] = 0;
          V2[(A2 << 1) + 1] = M2;
          if (M2 > n2)
            n2 = M2;
          A2++;
        }
        while (A2 < l2) {
          V2[A2 << 1] = 0;
          V2[(A2 << 1) + 1] = 0;
          A2++;
        }
        return n2;
      };
      H2.H.n = function(N2, W2) {
        var R2 = H2.H.m, V2 = N2.length, n2, A2, l2, M2, I2, e2 = R2.j;
        for (var M2 = 0; M2 <= W2; M2++)
          e2[M2] = 0;
        for (M2 = 1; M2 < V2; M2 += 2)
          e2[N2[M2]]++;
        var b2 = R2.K;
        n2 = 0;
        e2[0] = 0;
        for (A2 = 1; A2 <= W2; A2++) {
          n2 = n2 + e2[A2 - 1] << 1;
          b2[A2] = n2;
        }
        for (l2 = 0; l2 < V2; l2 += 2) {
          I2 = N2[l2 + 1];
          if (I2 != 0) {
            N2[l2] = b2[I2];
            b2[I2]++;
          }
        }
      };
      H2.H.A = function(N2, W2, R2) {
        var V2 = N2.length, n2 = H2.H.m, A2 = n2.r;
        for (var l2 = 0; l2 < V2; l2 += 2)
          if (N2[l2 + 1] != 0) {
            var M2 = l2 >> 1, I2 = N2[l2 + 1], e2 = M2 << 4 | I2, b2 = W2 - I2, Z2 = N2[l2] << b2, m2 = Z2 + (1 << b2);
            while (Z2 != m2) {
              var J2 = A2[Z2] >>> 15 - W2;
              R2[J2] = e2;
              Z2++;
            }
          }
      };
      H2.H.l = function(N2, W2) {
        var R2 = H2.H.m.r, V2 = 15 - W2;
        for (var n2 = 0; n2 < N2.length; n2 += 2) {
          var A2 = N2[n2] << W2 - N2[n2 + 1];
          N2[n2] = R2[A2] >>> V2;
        }
      };
      H2.H.M = function(N2, W2, R2) {
        R2 = R2 << (W2 & 7);
        var V2 = W2 >>> 3;
        N2[V2] |= R2;
        N2[V2 + 1] |= R2 >>> 8;
      };
      H2.H.I = function(N2, W2, R2) {
        R2 = R2 << (W2 & 7);
        var V2 = W2 >>> 3;
        N2[V2] |= R2;
        N2[V2 + 1] |= R2 >>> 8;
        N2[V2 + 2] |= R2 >>> 16;
      };
      H2.H.e = function(N2, W2, R2) {
        return (N2[W2 >>> 3] | N2[(W2 >>> 3) + 1] << 8) >>> (W2 & 7) & (1 << R2) - 1;
      };
      H2.H.b = function(N2, W2, R2) {
        return (N2[W2 >>> 3] | N2[(W2 >>> 3) + 1] << 8 | N2[(W2 >>> 3) + 2] << 16) >>> (W2 & 7) & (1 << R2) - 1;
      };
      H2.H.Z = function(N2, W2) {
        return (N2[W2 >>> 3] | N2[(W2 >>> 3) + 1] << 8 | N2[(W2 >>> 3) + 2] << 16) >>> (W2 & 7);
      };
      H2.H.i = function(N2, W2) {
        return (N2[W2 >>> 3] | N2[(W2 >>> 3) + 1] << 8 | N2[(W2 >>> 3) + 2] << 16 | N2[(W2 >>> 3) + 3] << 24) >>> (W2 & 7);
      };
      H2.H.m = function() {
        var N2 = Uint16Array, W2 = Uint32Array;
        return { K: new N2(16), j: new N2(16), X: [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], S: [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 999, 999, 999], T: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0], q: new N2(32), p: [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 65535, 65535], z: [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0], c: new W2(32), J: new N2(512), _: [], h: new N2(32), $: [], w: new N2(32768), C: [], v: [], d: new N2(32768), D: [], u: new N2(512), Q: [], r: new N2(1 << 15), s: new W2(286), Y: new W2(30), a: new W2(19), t: new W2(15e3), k: new N2(1 << 16), g: new N2(1 << 15) };
      }();
      (function() {
        var N2 = H2.H.m, W2 = 1 << 15;
        for (var R2 = 0; R2 < W2; R2++) {
          var V2 = R2;
          V2 = (V2 & 2863311530) >>> 1 | (V2 & 1431655765) << 1;
          V2 = (V2 & 3435973836) >>> 2 | (V2 & 858993459) << 2;
          V2 = (V2 & 4042322160) >>> 4 | (V2 & 252645135) << 4;
          V2 = (V2 & 4278255360) >>> 8 | (V2 & 16711935) << 8;
          N2.r[R2] = (V2 >>> 16 | V2 << 16) >>> 17;
        }
        function n2(A2, l2, M2) {
          while (l2-- != 0)
            A2.push(0, M2);
        }
        for (var R2 = 0; R2 < 32; R2++) {
          N2.q[R2] = N2.S[R2] << 3 | N2.T[R2];
          N2.c[R2] = N2.p[R2] << 4 | N2.z[R2];
        }
        n2(N2._, 144, 8);
        n2(N2._, 255 - 143, 9);
        n2(N2._, 279 - 255, 7);
        n2(N2._, 287 - 279, 8);
        H2.H.n(N2._, 9);
        H2.H.A(N2._, 9, N2.J);
        H2.H.l(N2._, 9);
        n2(N2.$, 32, 5);
        H2.H.n(N2.$, 5);
        H2.H.A(N2.$, 5, N2.h);
        H2.H.l(N2.$, 5);
        n2(N2.Q, 19, 0);
        n2(N2.C, 286, 0);
        n2(N2.D, 30, 0);
        n2(N2.v, 320, 0);
      })();
      return H2.H.N;
    }();
    function _readInterlace(data, out) {
      var w2 = out.width, h2 = out.height;
      var bpp = _getBPP(out), cbpp = bpp >> 3, bpl = Math.ceil(w2 * bpp / 8);
      var img = new Uint8Array(h2 * bpl);
      var di = 0;
      var starting_row = [0, 0, 4, 0, 2, 0, 1];
      var starting_col = [0, 4, 0, 2, 0, 1, 0];
      var row_increment = [8, 8, 8, 4, 4, 2, 2];
      var col_increment = [8, 8, 4, 4, 2, 2, 1];
      var pass = 0;
      while (pass < 7) {
        var ri = row_increment[pass], ci = col_increment[pass];
        var sw = 0, sh = 0;
        var cr = starting_row[pass];
        while (cr < h2) {
          cr += ri;
          sh++;
        }
        var cc = starting_col[pass];
        while (cc < w2) {
          cc += ci;
          sw++;
        }
        var bpll = Math.ceil(sw * bpp / 8);
        _filterZero(data, out, di, sw, sh);
        var y2 = 0, row = starting_row[pass];
        while (row < h2) {
          var col = starting_col[pass];
          var cdi = di + y2 * bpll << 3;
          while (col < w2) {
            if (bpp == 1) {
              var val = data[cdi >> 3];
              val = val >> 7 - (cdi & 7) & 1;
              img[row * bpl + (col >> 3)] |= val << 7 - ((col & 7) << 0);
            }
            if (bpp == 2) {
              var val = data[cdi >> 3];
              val = val >> 6 - (cdi & 7) & 3;
              img[row * bpl + (col >> 2)] |= val << 6 - ((col & 3) << 1);
            }
            if (bpp == 4) {
              var val = data[cdi >> 3];
              val = val >> 4 - (cdi & 7) & 15;
              img[row * bpl + (col >> 1)] |= val << 4 - ((col & 1) << 2);
            }
            if (bpp >= 8) {
              var ii = row * bpl + col * cbpp;
              for (var j2 = 0; j2 < cbpp; j2++)
                img[ii + j2] = data[(cdi >> 3) + j2];
            }
            cdi += bpp;
            col += ci;
          }
          y2++;
          row += ri;
        }
        if (sw * sh != 0)
          di += sh * (1 + bpll);
        pass = pass + 1;
      }
      return img;
    }
    function _getBPP(out) {
      var noc = [1, null, 3, 1, 2, null, 4][out.ctype];
      return noc * out.depth;
    }
    function _filterZero(data, out, off, w2, h2) {
      var bpp = _getBPP(out), bpl = Math.ceil(w2 * bpp / 8);
      bpp = Math.ceil(bpp / 8);
      var i2, di, type = data[off], x2 = 0;
      if (type > 1)
        data[off] = [0, 0, 1][type - 2];
      if (type == 3)
        for (x2 = bpp; x2 < bpl; x2++)
          data[x2 + 1] = data[x2 + 1] + (data[x2 + 1 - bpp] >>> 1) & 255;
      for (var y2 = 0; y2 < h2; y2++) {
        i2 = off + y2 * bpl;
        di = i2 + y2 + 1;
        type = data[di - 1];
        x2 = 0;
        if (type == 0)
          for (; x2 < bpl; x2++)
            data[i2 + x2] = data[di + x2];
        else if (type == 1) {
          for (; x2 < bpp; x2++)
            data[i2 + x2] = data[di + x2];
          for (; x2 < bpl; x2++)
            data[i2 + x2] = data[di + x2] + data[i2 + x2 - bpp];
        } else if (type == 2) {
          for (; x2 < bpl; x2++)
            data[i2 + x2] = data[di + x2] + data[i2 + x2 - bpl];
        } else if (type == 3) {
          for (; x2 < bpp; x2++)
            data[i2 + x2] = data[di + x2] + (data[i2 + x2 - bpl] >>> 1);
          for (; x2 < bpl; x2++)
            data[i2 + x2] = data[di + x2] + (data[i2 + x2 - bpl] + data[i2 + x2 - bpp] >>> 1);
        } else {
          for (; x2 < bpp; x2++)
            data[i2 + x2] = data[di + x2] + _paeth(0, data[i2 + x2 - bpl], 0);
          for (; x2 < bpl; x2++)
            data[i2 + x2] = data[di + x2] + _paeth(data[i2 + x2 - bpp], data[i2 + x2 - bpl], data[i2 + x2 - bpp - bpl]);
        }
      }
      return data;
    }
    function _paeth(a2, b2, c2) {
      var p2 = a2 + b2 - c2, pa = p2 - a2, pb = p2 - b2, pc = p2 - c2;
      if (pa * pa <= pb * pb && pa * pa <= pc * pc)
        return a2;
      else if (pb * pb <= pc * pc)
        return b2;
      return c2;
    }
    function _IHDR(data, offset, out) {
      out.width = _bin.readUint(data, offset);
      offset += 4;
      out.height = _bin.readUint(data, offset);
      offset += 4;
      out.depth = data[offset];
      offset++;
      out.ctype = data[offset];
      offset++;
      out.compress = data[offset];
      offset++;
      out.filter = data[offset];
      offset++;
      out.interlace = data[offset];
      offset++;
    }
    function _copyTile(sb, sw, sh, tb, tw, th, xoff, yoff, mode) {
      var w2 = Math.min(sw, tw), h2 = Math.min(sh, th);
      var si = 0, ti = 0;
      for (var y2 = 0; y2 < h2; y2++)
        for (var x2 = 0; x2 < w2; x2++) {
          if (xoff >= 0 && yoff >= 0) {
            si = y2 * sw + x2 << 2;
            ti = (yoff + y2) * tw + xoff + x2 << 2;
          } else {
            si = (-yoff + y2) * sw - xoff + x2 << 2;
            ti = y2 * tw + x2 << 2;
          }
          if (mode == 0) {
            tb[ti] = sb[si];
            tb[ti + 1] = sb[si + 1];
            tb[ti + 2] = sb[si + 2];
            tb[ti + 3] = sb[si + 3];
          } else if (mode == 1) {
            var fa = sb[si + 3] * (1 / 255), fr = sb[si] * fa, fg = sb[si + 1] * fa, fb = sb[si + 2] * fa;
            var ba = tb[ti + 3] * (1 / 255), br = tb[ti] * ba, bg = tb[ti + 1] * ba, bb = tb[ti + 2] * ba;
            var ifa = 1 - fa, oa = fa + ba * ifa, ioa = oa == 0 ? 0 : 1 / oa;
            tb[ti + 3] = 255 * oa;
            tb[ti + 0] = (fr + br * ifa) * ioa;
            tb[ti + 1] = (fg + bg * ifa) * ioa;
            tb[ti + 2] = (fb + bb * ifa) * ioa;
          } else if (mode == 2) {
            var fa = sb[si + 3], fr = sb[si], fg = sb[si + 1], fb = sb[si + 2];
            var ba = tb[ti + 3], br = tb[ti], bg = tb[ti + 1], bb = tb[ti + 2];
            if (fa == ba && fr == br && fg == bg && fb == bb) {
              tb[ti] = 0;
              tb[ti + 1] = 0;
              tb[ti + 2] = 0;
              tb[ti + 3] = 0;
            } else {
              tb[ti] = fr;
              tb[ti + 1] = fg;
              tb[ti + 2] = fb;
              tb[ti + 3] = fa;
            }
          } else if (mode == 3) {
            var fa = sb[si + 3], fr = sb[si], fg = sb[si + 1], fb = sb[si + 2];
            var ba = tb[ti + 3], br = tb[ti], bg = tb[ti + 1], bb = tb[ti + 2];
            if (fa == ba && fr == br && fg == bg && fb == bb)
              continue;
            if (fa < 220 && ba > 20)
              return false;
          }
        }
      return true;
    }
    class AJAXError extends Error {
      constructor(status, statusText, url, body) {
        super(`AJAXError: ${statusText} (${status}): ${url}`);
        this.status = status;
        this.statusText = statusText;
        this.url = url;
        this.body = body;
      }
    }
    const isFileURL = (url) => /^file:/.test(url) || /^file:/.test(getReferrer()) && !/^\w+:/.test(url);
    function makeFetchRequest(requestParameters, callback) {
      const controller = new AbortController();
      const request2 = new Request(requestParameters.url, {
        method: requestParameters.method || "GET",
        body: requestParameters.body,
        credentials: requestParameters.credentials,
        headers: requestParameters.headers,
        referrer: getReferrer(),
        signal: controller.signal
      });
      let complete = false;
      let aborted = false;
      if (requestParameters.type === "json") {
        request2.headers.set("Accept", "application/json");
      }
      const validateOrFetch = (err, cachedResponse, responseIsFresh) => {
        if (aborted)
          return;
        if (err) {
          if (err.message !== "SecurityError") {
            warnOnce(err);
          }
        }
        if (cachedResponse && responseIsFresh) {
          return finishRequest(cachedResponse);
        }
        fetch(request2).then((response) => {
          if (response.ok) {
            return finishRequest(response);
          } else {
            return response.blob().then((body) => callback(new AJAXError(response.status, response.statusText, requestParameters.url, body)));
          }
        }).catch((error) => {
          if (error.code === 20)
            ;
          callback(new Error(error.message));
        });
      };
      const finishRequest = (response) => {
        (requestParameters.type === "arrayBuffer" ? response.arrayBuffer() : requestParameters.type === "json" ? response.json() : response.text()).then((result) => {
          if (aborted)
            return;
          complete = true;
          callback(null, result, response.headers.get("Cache-Control"), response.headers.get("Expires"));
        }).catch((err) => {
          if (!aborted)
            callback(new Error(err.message));
        });
      };
      validateOrFetch(null, null);
      return {
        cancel: () => {
          aborted = true;
          if (!complete)
            controller.abort();
        }
      };
    }
    function makeXMLHttpRequest(requestParameters, callback) {
      const xhr = new XMLHttpRequest();
      xhr.open(requestParameters.method || "GET", requestParameters.url, true);
      if (requestParameters.type === "arrayBuffer") {
        xhr.responseType = "arraybuffer";
      }
      for (const k2 in requestParameters.headers) {
        xhr.setRequestHeader(k2, requestParameters.headers[k2]);
      }
      if (requestParameters.type === "json") {
        xhr.responseType = "text";
        xhr.setRequestHeader("Accept", "application/json");
      }
      xhr.withCredentials = requestParameters.credentials === "include";
      xhr.onerror = () => {
        callback(new Error(xhr.statusText));
      };
      xhr.onload = () => {
        if ((xhr.status >= 200 && xhr.status < 300 || xhr.status === 0) && xhr.response !== null) {
          let data = xhr.response;
          if (requestParameters.type === "json") {
            try {
              data = JSON.parse(xhr.response);
            } catch (err) {
              return callback(err);
            }
          }
          callback(null, data, xhr.getResponseHeader("Cache-Control"), xhr.getResponseHeader("Expires"));
        } else {
          const body = new Blob([xhr.response], { type: xhr.getResponseHeader("Content-Type") });
          callback(new AJAXError(xhr.status, xhr.statusText, requestParameters.url, body));
        }
      };
      xhr.send(requestParameters.body);
      return { cancel: () => xhr.abort() };
    }
    const makeRequest = function(requestParameters, callback) {
      if (/:\/\//.test(requestParameters.url) && !/^https?:|^file:/.test(requestParameters.url)) {
        if (isWorker() && self.worker && self.worker.actor) {
          return self.worker.actor.send("getResource", requestParameters, callback);
        }
        if (!isWorker()) {
          return makeFetchRequest(requestParameters, callback);
        }
      }
      if (!isFileURL(requestParameters.url)) {
        if (
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          fetch && Request && AbortController && Object.prototype.hasOwnProperty.call(Request.prototype, "signal")
        ) {
          return makeFetchRequest(requestParameters, callback);
        }
        if (isWorker() && self.worker && self.worker.actor) {
          const queueOnMainThread = true;
          return self.worker.actor.send("getResource", requestParameters, callback, void 0, queueOnMainThread);
        }
      }
      return makeXMLHttpRequest(requestParameters, callback);
    };
    let pool;
    function getPool() {
      if (!pool) {
        pool = new self.GeoTIFF.Pool();
      }
      return pool;
    }
    class RequestAdapter {
      constructor(options) {
        this.requestScheduler = new RequestScheduler(options);
      }
      getResource(mapId, params, callback) {
        return makeRequest(params, callback);
      }
      /**
       * arrayBuffer 转 Unit8
       * @param data
       * @param callback
       */
      arrayBuffer2unit8(data, callback) {
        const pngImage = decode2(data);
        const pixels = toRGBA8(pngImage);
        callback(null, {
          data: new Uint8Array(pixels[0]),
          width: pngImage.width,
          height: pngImage.height
        });
      }
      /**
       * arrayBuffer 转图像
       * 1. 如果支持 ImageBitmap 则生成 `ImageBitmap` 除了极少数浏览器不支持外兼容性尚可
       * 2. 在 safari 和移动浏览器下配合 rgba2float 有精度问题，不建议使用
       * @param data
       * @param callback
       */
      arrayBuffer2Image(data, callback) {
        const imageBitmapSupported = typeof createImageBitmap === "function";
        if (imageBitmapSupported) {
          arrayBufferToImageBitmap(data, callback);
        } else {
          this.arrayBuffer2unit8(data, callback);
        }
      }
      /**
       * geotiff 解析
       * @param data
       * @param callback
       */
      arrayBuffer2tiff(data, callback) {
        if (!self.GeoTIFF) {
          throw new Error("Must config [geotiff](https://github.com/geotiffjs/geotiff.js) dep use `configDeps`");
        }
        self.GeoTIFF.fromArrayBuffer(data).then((geotiff) => {
          geotiff.getImage().then((image) => {
            const result = {};
            const fileDirectory = image.fileDirectory;
            const { GeographicTypeGeoKey, ProjectedCSTypeGeoKey } = image.getGeoKeys();
            result.projection = ProjectedCSTypeGeoKey || GeographicTypeGeoKey;
            const height = image.getHeight();
            result.height = height;
            const width = image.getWidth();
            result.width = width;
            const [resolutionX, resolutionY] = image.getResolution();
            result.pixelHeight = Math.abs(resolutionY);
            result.pixelWidth = Math.abs(resolutionX);
            const [originX, originY] = image.getOrigin();
            result.xmin = originX;
            result.xmax = result.xmin + width * result.pixelWidth;
            result.ymax = originY;
            result.ymin = result.ymax - height * result.pixelHeight;
            result.noDataValue = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null;
            result.numberOfRasters = fileDirectory.SamplesPerPixel;
            image.readRasters({ pool: getPool() }).then((rasters) => {
              result.rasters = rasters;
              const r2 = rasters[0];
              if (r2) {
                let i2 = 0;
                const bands = rasters.length;
                const d2 = new r2.constructor(r2.length * bands);
                for (; i2 < r2.length; i2++) {
                  for (let j2 = 0; j2 < bands; j2++) {
                    d2[i2 + j2] = rasters[j2][i2];
                  }
                }
                result.data = d2;
              }
              result.metadata = image.getGDALMetadata();
              const metadata = parseMetedata(fileDirectory.ImageDescription || "");
              result.min = metadata.min;
              result.max = metadata.max;
              result.isTiff = true;
              callback(null, result);
            }).catch((err) => {
              callback(err);
            });
          }).catch((err) => {
            callback(err);
          });
        }).catch((err) => {
          callback(err);
        });
      }
      /**
       * 解析 exif 信息
       * @param data
       * @param callback
       */
      parseExif(data, callback) {
        Z(data).then((res) => {
          this.arrayBuffer2Image(data, (error, image) => {
            if (error) {
              callback(error);
            } else {
              callback(null, {
                data: isImageBitmap2(image) ? image : image.data,
                width: image.width,
                height: image.height,
                exif: res,
                withExif: true
              });
            }
          });
        }).catch((err) => {
          callback(err);
        });
      }
      fetch(params, callback) {
        let aborted = false;
        const r2 = this.requestScheduler.scheduleRequest(() => {
          const p2 = new Promise((resolve) => {
            const request2 = makeRequest(params, (...args) => {
              if (aborted) {
                resolve(false);
                return;
              }
              callback(...args);
              resolve(args);
            });
            p2.cancel = () => {
              request2.cancel();
            };
          });
          return p2;
        });
        return {
          cancel: () => {
            aborted = true;
            r2.cancel();
          }
        };
      }
    }
    let request = null;
    function getRequest(options = {}, force = false) {
      if (!request || force) {
        request = new RequestAdapter(options);
      }
      return request;
    }
    const registry = {};
    function register(name, klass, options = {}) {
      if (registry[name])
        throw new Error(`${name} is already registered.`);
      Object.defineProperty(klass, "_classRegistryKey", {
        value: name,
        writeable: false
      });
      registry[name] = {
        klass,
        omit: options.omit || [],
        shallow: options.shallow || []
      };
    }
    register("Object", Object);
    register("Error", Error);
    register("AJAXError", AJAXError);
    function serialize(input, transferables) {
      if (input === null || input === void 0 || typeof input === "boolean" || typeof input === "number" || typeof input === "string" || input instanceof Boolean || input instanceof Number || input instanceof String || input instanceof Date || input instanceof RegExp || input instanceof Blob) {
        return input;
      }
      if (isArrayBuffer(input)) {
        if (transferables) {
          transferables.push(input);
        }
        return input;
      }
      if (isImageBitmap2(input)) {
        if (transferables) {
          transferables.push(input);
        }
        return input;
      }
      if (ArrayBuffer.isView(input)) {
        const view = input;
        if (transferables) {
          transferables.push(view.buffer);
        }
        return view;
      }
      if (input instanceof ImageData) {
        if (transferables) {
          transferables.push(input.data.buffer);
        }
        return input;
      }
      if (Array.isArray(input)) {
        const serialized = [];
        for (const item of input) {
          serialized.push(serialize(item, transferables));
        }
        return serialized;
      }
      if (typeof input === "object") {
        const klass = input.constructor;
        const name = klass._classRegistryKey;
        if (!name) {
          throw new Error("can't serialize object of unregistered class");
        }
        if (!registry[name])
          throw new Error(`${name} is not registered.`);
        const properties = klass.serialize ? (
          // (Temporary workaround) allow a class to provide static
          // `serialize()` and `deserialize()` methods to bypass the generic
          // approach.
          // This temporary workaround lets us use the generic serialization
          // approach for objects whose members include instances of dynamic
          // StructArray types. Once we refactor StructArray to be static,
          // we can remove this complexity.
          klass.serialize(input, transferables)
        ) : {};
        if (!klass.serialize) {
          for (const key in input) {
            if (!input.hasOwnProperty(key))
              continue;
            if (registry[name].omit.indexOf(key) >= 0)
              continue;
            const property = input[key];
            properties[key] = registry[name].shallow.indexOf(key) >= 0 ? property : serialize(property, transferables);
          }
          if (input instanceof Error) {
            properties.message = input.message;
          }
        } else if (transferables && properties === transferables[transferables.length - 1]) {
          throw new Error("statically serialized object won't survive transfer of $name property");
        }
        if (properties.$name) {
          throw new Error("$name property is reserved for worker serialization logic.");
        }
        if (name !== "Object") {
          properties.$name = name;
        }
        return properties;
      }
      throw new Error(`can't serialize object of type ${typeof input}`);
    }
    function deserialize(input) {
      if (input === null || input === void 0 || typeof input === "boolean" || typeof input === "number" || typeof input === "string" || input instanceof Boolean || input instanceof Number || input instanceof String || input instanceof Date || input instanceof RegExp || input instanceof Blob || isArrayBuffer(input) || isImageBitmap2(input) || ArrayBuffer.isView(input) || input instanceof ImageData) {
        return input;
      }
      if (Array.isArray(input)) {
        return input.map(deserialize);
      }
      if (typeof input === "object") {
        const name = input.$name || "Object";
        if (!registry[name]) {
          throw new Error(`can't deserialize unregistered class ${name}`);
        }
        const { klass } = registry[name];
        if (!klass) {
          throw new Error(`can't deserialize unregistered class ${name}`);
        }
        if (klass.deserialize) {
          return klass.deserialize(input);
        }
        const result = Object.create(klass.prototype);
        for (const key of Object.keys(input)) {
          if (key === "$name")
            continue;
          const value = input[key];
          result[key] = registry[name].shallow.indexOf(key) >= 0 ? value : deserialize(value);
        }
        return result;
      }
      throw new Error(`can't deserialize object of type ${typeof input}`);
    }
    class ThrottledInvoker {
      constructor(callback) {
        this.callback = callback;
        this.triggered = false;
        if (typeof MessageChannel !== "undefined") {
          this.channel = new MessageChannel();
          this.channel.port2.onmessage = () => {
            this.triggered = false;
            this.callback();
          };
        }
      }
      trigger() {
        if (!this.triggered) {
          this.triggered = true;
          if (this.channel) {
            this.channel.port1.postMessage(true);
          } else {
            setTimeout(() => {
              this.triggered = false;
              this.callback();
            }, 0);
          }
        }
      }
      remove() {
        this.channel = null;
        this.callback = nullFunction;
      }
    }
    class Actor {
      constructor(target, parent, dispatcherId) {
        this.target = target;
        this.parent = parent;
        this.id = uid("actor");
        this.dispatcherId = dispatcherId;
        this.callbacks = {};
        this.tasks = {};
        this.taskQueue = [];
        this.cancelCallbacks = {};
        this.receive = this.receive.bind(this);
        this.process = this.process.bind(this);
        this.invoker = new ThrottledInvoker(this.process);
        this.target.addEventListener("message", this.receive, false);
        this.globalScope = isWorker() ? target : window;
      }
      /**
       * Sends a message from a main-thread map to a Worker or from a Worker back to
       * a main-thread map instance.
       *
       * @param type The name of the target method to invoke or '[source-type].[source-name].name' for a method on a WorkerSource.
       * @param data
       * @param callback
       * @param targetId A particular mapId to which to send this message.
       * @param mustQueue
       * @private
       */
      send(type, data, callback, targetId, mustQueue = false) {
        const id = Math.round(Math.random() * 1e18).toString(36).substring(0, 10);
        if (callback) {
          this.callbacks[id] = callback;
        }
        const buffers = isSafari(this.globalScope) ? void 0 : [];
        this.target.postMessage(
          {
            id,
            type,
            hasCallback: !!callback,
            targetId,
            mustQueue,
            dispatcherId: this.dispatcherId,
            data: serialize(data, buffers)
          },
          buffers
        );
        return {
          cancel: () => {
            if (callback) {
              delete this.callbacks[id];
            }
            this.target.postMessage({
              id,
              type: "<cancel>",
              targetId,
              dispatcherId: this.dispatcherId
            });
          }
        };
      }
      receive(message) {
        const { data } = message;
        const { id } = data;
        if (!id) {
          return;
        }
        if (data.targetId && this.dispatcherId !== data.targetId) {
          return;
        }
        if (data.type === "<cancel>") {
          delete this.tasks[id];
          const cancel = this.cancelCallbacks[id];
          delete this.cancelCallbacks[id];
          if (cancel) {
            cancel();
          }
        } else if (isWorker() || data.mustQueue) {
          this.tasks[id] = data;
          this.taskQueue.push(id);
          this.invoker.trigger();
        } else {
          this.processTask(id, data);
        }
      }
      process() {
        if (!this.taskQueue.length) {
          return;
        }
        const id = this.taskQueue.shift();
        if (id === void 0)
          return;
        const task = this.tasks[id];
        delete this.tasks[id];
        if (this.taskQueue.length) {
          this.invoker.trigger();
        }
        if (!task) {
          return;
        }
        this.processTask(id, task);
      }
      processTask(id, task) {
        if (task.type === "<response>") {
          const callback = this.callbacks[id];
          delete this.callbacks[id];
          if (callback) {
            if (task.error) {
              callback(deserialize(task.error));
            } else {
              callback(null, deserialize(task.data));
            }
          }
        } else {
          let completed = false;
          const buffers = isSafari(this.globalScope) ? void 0 : [];
          const done = task.hasCallback ? (err, data) => {
            completed = true;
            delete this.cancelCallbacks[id];
            this.target.postMessage(
              {
                id,
                type: "<response>",
                dispatcherId: this.dispatcherId,
                error: err ? serialize(err) : null,
                data: serialize(data, buffers)
              },
              buffers
            );
          } : () => {
            completed = true;
          };
          let callback = null;
          const params = deserialize(task.data);
          if (this.parent[task.type]) {
            callback = this.parent[task.type]?.(task.dispatcherId, params, done);
          } else {
            done(new Error(`Could not find function ${task.type}`));
          }
          if (!completed && callback && callback.cancel) {
            this.cancelCallbacks[id] = callback.cancel;
          }
        }
      }
      remove() {
        this.invoker.remove();
        this.target.removeEventListener("message", this.receive, false);
      }
    }
    exports.Actor = Actor;
    exports.RequestScheduler = RequestScheduler;
    exports.ThrottledInvoker = ThrottledInvoker;
    exports.asyncAll = asyncAll;
    exports.getReferrer = getReferrer;
    exports.getRequest = getRequest;
    exports.isWorker = isWorker;
    exports.nullFunction = nullFunction;
    exports.register = register;
    exports.uid = uid;
    exports.utils = utils2;
  });
  define(["./shared"], function(Actor) {
    class Worker2 {
      constructor(self2) {
        this.cancelMap = /* @__PURE__ */ new Map();
        this.self = self2;
        this.actor = new Actor.Actor(self2, this);
        this.request = Actor.getRequest();
      }
      setReferrer(dispatcherId, referrer) {
        this.referrer = referrer;
      }
      configDeps(dispatcherId, deps, callback) {
        if (deps && Array.isArray(deps) && deps.length > 0) {
          try {
            self.importScripts(...deps);
            callback(null, true);
          } catch (e) {
            Actor.asyncAll(
              deps,
              (d, done) => {
                this.request.fetch(
                  {
                    url: d,
                    type: "arrayBuffer"
                  },
                  (err, data) => {
                    if (err) {
                      done(err, false);
                      return console.error(err);
                    }
                    const url = URL.createObjectURL(new Blob([data], { type: "application/javascript" }));
                    self.importScripts(url);
                    setTimeout(() => {
                      URL.revokeObjectURL(url);
                    });
                    done(null, true);
                  }
                );
              },
              callback
            );
          }
        } else {
          callback(null, true);
        }
      }
      loadData(dispatcherId, params, callback) {
        const cancelId = params?.cancelId;
        const { cancel } = this.request.fetch(params, (err, data) => {
          this.cancelMap.delete(cancelId);
          if (err) {
            callback(err);
          } else {
            if (params?.decodeType === 0) {
              this.request.arrayBuffer2Image(data, callback);
            } else if (params?.decodeType === 1) {
              this.request.arrayBuffer2unit8(data, callback);
            } else if (params?.decodeType === 2) {
              this.request.arrayBuffer2tiff(data, callback);
            } else if (params?.decodeType === 3) {
              this.request.parseExif(data, callback);
            }
          }
        });
        this.cancelMap.set(cancelId, cancel);
      }
      cancel(dispatcherId, params, callback) {
        const cancelId = params?.cancelId;
        const c = this.cancelMap.get(cancelId);
        if (c) {
          c();
          callback(null, true);
        } else {
          callback(new Error("\u65E0\u76F8\u5173\u7684\u53EF\u53D6\u6D88\u8BF7\u6C42\uFF01"));
        }
      }
    }
    if (Actor.isWorker()) {
      self.worker = new Worker2(self);
    }
    return Worker2;
  });
  define(["./shared"], function(Actor) {
    let u = "";
    function setWorkerUrl(url) {
      u = url;
    }
    function getWorkerUrl() {
      return u;
    }
    let deps = [];
    function configDeps2(d) {
      deps = d;
    }
    function getConfigDeps() {
      return deps;
    }
    function workerFactory() {
      return new Worker(getWorkerUrl());
    }
    const PRELOAD_POOL_ID = "__wind_layer_preloaded_worker_pool__";
    class WorkerPool {
      constructor() {
        this.active = {};
      }
      /**
       * 获取 `Worker` 实例
       * @param id
       */
      acquire(id) {
        if (!this.workers) {
          this.workers = [];
          for (let i = 0; i < WorkerPool.workerCount; i++) {
            const worker2 = workerFactory();
            if (worker2) {
              this.workers.push(worker2);
            }
          }
        }
        this.active[id] = true;
        return this.workers.slice();
      }
      /**
       * 释放所有 `Worker`
       * @param id
       */
      release(id) {
        delete this.active[id];
        if (this.numActive() === 0 && this.workers) {
          this.workers.forEach((w) => {
            w.terminate();
          });
          this.workers = null;
        }
      }
      isPreloaded() {
        return !!this.active[PRELOAD_POOL_ID];
      }
      /**
       * 获取激活的`Worker` 数量
       */
      numActive() {
        return Object.keys(this.active).length;
      }
    }
    const hardwareConcurrency = typeof navigator !== "undefined" && navigator.hardwareConcurrency || 4;
    const availableLogicalProcessors = Math.floor(hardwareConcurrency / 2);
    WorkerPool.workerCount = Math.max(Math.min(availableLogicalProcessors, 6), 1);
    class Dispatcher {
      constructor(workerPool, parent, dispatcherId) {
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = Actor.uid("dispatcher");
        this.dispatcherId = dispatcherId;
        const workers = this.workerPool.acquire(this.dispatcherId);
        for (let i = 0; i < workers.length; i++) {
          const worker2 = workers[i];
          const actor = new Actor.Actor(worker2, parent, this.dispatcherId);
          actor.name = `Worker ${i}`;
          this.actors.push(actor);
        }
        if (!this.actors.length)
          throw new Error("No actors found");
      }
      /**
       * 广播到所有 Actor
       * @param type
       * @param data
       * @param cb
       */
      broadcast(type, data, cb) {
        cb = cb || Actor.nullFunction;
        Actor.asyncAll(
          this.actors,
          (actor, done) => {
            actor.send(type, data, done);
          },
          cb
        );
      }
      send(type, data, cb, id) {
        const actor = this.getActor(id);
        if (actor) {
          actor.send(type, data, cb);
        }
      }
      /**
       * 获取要发送消息的 `Actor`
       * TIP: 是否需要实现 `Actor` 是否占用判断
       */
      getActor(id) {
        if (id !== void 0) {
          const index = this.actors.findIndex((a) => a.id === id);
          if (index > -1) {
            this.currentActor = index;
          } else {
            this.currentActor = (this.currentActor + 1) % this.actors.length;
          }
        } else {
          this.currentActor = (this.currentActor + 1) % this.actors.length;
        }
        return this.actors[this.currentActor];
      }
      remove(removed = true) {
        this.actors.forEach((actor) => {
          actor.remove();
        });
        this.actors = [];
        if (removed)
          this.workerPool.release(this.id);
      }
    }
    let globalWorkerPool;
    function getGlobalWorkerPool() {
      if (!globalWorkerPool) {
        globalWorkerPool = new WorkerPool();
      }
      return globalWorkerPool;
    }
    function prewarm() {
      const workerPool = getGlobalWorkerPool();
      workerPool.acquire(PRELOAD_POOL_ID);
    }
    const exported = {
      utils: Actor.utils,
      request: Actor.getRequest,
      register: Actor.register,
      configDeps: configDeps2,
      getConfigDeps,
      prewarm,
      getReferrer: Actor.getReferrer,
      setWorkerUrl,
      getGlobalWorkerPool,
      Actor: Actor.Actor,
      WorkerPool,
      Dispatcher,
      RequestScheduler: Actor.RequestScheduler,
      ThrottledInvoker: Actor.ThrottledInvoker
    };
    return exported;
  });
  var wgw$1 = wgw;
  class Pipelines {
    #passes = [];
    constructor(renderer) {
      this.enabled = true;
      this.renderer = renderer;
    }
    get passes() {
      return this.#passes;
    }
    get length() {
      return this.passes.length;
    }
    resize(width, height) {
      const len = this.#passes.length;
      for (let i = 0; i < len; i++) {
        const pass = this.#passes[i];
        pass.resize?.(width, height);
      }
    }
    addPass(pass) {
      this.#passes.push(pass);
    }
    removePass(pass) {
      const idx = this.#passes.indexOf(pass);
      if (idx > -1) {
        this.#passes.splice(pass, 1);
        pass.destroy();
      }
    }
    removePasses() {
      this.#passes.forEach((pass) => pass.destroy());
      this.#passes = [];
    }
    getPass(id) {
      return this.#passes.find((pass) => pass.id === id);
    }
    prerender(rendererParams, rendererState) {
      const passes = this.#passes.filter((p) => p.enabled && p.prerender === true);
      if (passes.length > 0) {
        const len = passes.length;
        for (let i = 0; i < len; i++) {
          const pass = passes[i];
          pass.render(rendererParams, rendererState);
        }
        this.renderer.resetState();
      }
    }
    render(rendererParams, rendererState) {
      const passes = this.#passes.filter((p) => p.enabled && p.prerender !== true);
      if (passes.length > 0) {
        const len = passes.length;
        for (let i = 0; i < len; i++) {
          const pass = passes[i];
          pass.render(rendererParams, rendererState);
        }
        this.renderer.resetState();
      }
    }
    destroy() {
      this.#passes.forEach((pass) => pass.destroy());
    }
  }
  const ERR_PASS_METHOD_UNDEFINED = "Pass subclass must define virtual methods";
  class Pass {
    #enabled = true;
    constructor(id, renderer, options = {}) {
      this.id = id;
      this.renderer = renderer;
      this.options = options;
      this.setMaskPass(this.options.maskPass);
    }
    get enabled() {
      return this.#enabled;
    }
    set enabled(state) {
      this.#enabled = state;
    }
    setMaskPass(pass) {
      this.maskPass = pass;
    }
    render(rendererParams, rendererState, cb) {
      throw new Error(ERR_PASS_METHOD_UNDEFINED);
    }
    destroy() {
      throw new Error(ERR_PASS_METHOD_UNDEFINED);
    }
  }
  var vert$4 = "#define GLSLIFY 1\nattribute vec2 uv;attribute vec3 position;uniform vec3 cameraPosition;uniform mat4 viewMatrix;uniform mat4 modelMatrix;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;varying vec2 vUv;void main(){vUv=vec2(uv.x,1.0-uv.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
  var frag$8 = "#defines\nprecision highp float;\n#define GLSLIFY 1\nvarying vec2 vUv;uniform sampler2D u_image0;uniform sampler2D u_image1;\n#include <decodeFloat>\n#if RENDER_TYPE == 1\nuniform vec4 dataRange;vec4 getColor(const vec2 uv){vec2 rg=texture2D(u_image0,uv).rg;vec2 data=rg*(dataRange.yw-dataRange.xz)+dataRange.xz;return vec4(data.xy,0.0,1.0);}\n#elif RENDER_TYPE == 0\nuniform vec2 dataRange;vec4 getColor(const vec2 uv){float r=texture2D(u_image0,uv).r;float rf=r*(dataRange.y-dataRange.x)+dataRange.x;return vec4(rf,0.0,0.0,1.0);}\n#elif RENDER_TYPE == 2\nvec4 getColor(const vec2 uv){vec4 rgba=texture2D(u_image0,uv).rgba;float r=decode_float(rgba,LITTLE_ENDIAN);return vec4(r,0.0,0.0,1.0);}\n#else\nvec4 getColor(const vec2 uv){return texture2D(u_image0,uv).rgba;}\n#endif\nvoid main(){gl_FragColor=getColor(vUv);}";
  var random = "#define GLSLIFY 1\nhighp float rand(vec2 co){highp float a=12.9898;highp float b=78.233;highp float c=43758.5453;highp float dt=dot(co.xy,vec2(a,b));highp float sn=mod(dt,3.14);return fract(sin(sn)*c);}";
  var encode = "#define GLSLIFY 1\nconst vec2 bitEnc=vec2(1.0,255.0);const vec2 bitDec=1.0/bitEnc;vec4 toRGBA(const vec2 pos){vec2 rg=bitEnc*pos.x;rg=fract(rg);rg-=rg.yy*vec2(1.0/255.0,0.0);vec2 ba=bitEnc*pos.y;ba=fract(ba);ba-=ba.yy*vec2(1.0/255.0,0.0);return vec4(rg,ba);}";
  var encodeFloat = "#define GLSLIFY 1\n#define FLOAT_MAX 1.70141184e38\n#define FLOAT_MIN 1.17549435e-38\nlowp vec4 encode_float(highp float v){highp float av=abs(v);if(av<FLOAT_MIN){return vec4(0.0,0.0,0.0,0.0);}else if(v>FLOAT_MAX){return vec4(127.0,128.0,0.0,0.0)/255.0;}else if(v<-FLOAT_MAX){return vec4(255.0,128.0,0.0,0.0)/255.0;}highp vec4 c=vec4(0,0,0,0);highp float e=floor(log2(av));highp float m=av*pow(2.0,-e)-1.0;c[1]=floor(128.0*m);m-=c[1]/128.0;c[2]=floor(32768.0*m);m-=c[2]/32768.0;c[3]=floor(8388608.0*m);highp float ebias=e+127.0;c[0]=floor(ebias/2.0);ebias-=c[0]*2.0;c[1]+=floor(ebias)*128.0;c[0]+=128.0*step(0.0,-v);return c/255.0;}";
  var decode = "#define GLSLIFY 1\nconst vec2 bitEnc=vec2(1.0,255.0);const vec2 bitDec=1.0/bitEnc;vec2 fromRGBA(const vec4 color){vec4 rounded_color=floor(color*255.0+0.5)/255.0;float x=dot(rounded_color.rg,bitDec);float y=dot(rounded_color.ba,bitDec);return vec2(x,y);}";
  var decodeFloat = "#define GLSLIFY 1\nvec4 floatsToBytes(vec4 inputFloats,bool littleEndian){vec4 bytes=vec4(inputFloats*255.0);return(littleEndian? bytes.abgr: bytes);}float decode_float(vec4 v,bool littleEndian){vec4 bits=floatsToBytes(v,littleEndian);float sign=mix(-1.0,1.0,step(bits[3],128.0));float expo=floor(mod(bits[3]+0.2,128.0))*2.0+floor((bits[2]+0.2)/128.0)-127.0;float sig=bits[0]+bits[1]*256.0+floor(mod(bits[2]+0.2,128.0))*256.0*256.0;return sign*(1.0+sig/8388607.0)*pow(2.0,expo);}";
  var shaderLib = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    decode,
    decodeFloat,
    encode,
    encodeFloat,
    random
  });
  function isFunction(val) {
    return index.typeOf(val) === "function";
  }
  function findStopLessThanOrEqualTo(stops, input) {
    const lastIndex = stops.length - 1;
    let lowerIndex = 0;
    let upperIndex = lastIndex;
    let currentIndex = 0;
    let currentValue;
    let nextValue;
    while (lowerIndex <= upperIndex) {
      currentIndex = Math.floor((lowerIndex + upperIndex) / 2);
      currentValue = stops[currentIndex];
      nextValue = stops[currentIndex + 1];
      if (currentValue <= input) {
        if (currentIndex === lastIndex || input < nextValue) {
          return currentIndex;
        }
        lowerIndex = currentIndex + 1;
      } else if (currentValue > input) {
        upperIndex = currentIndex - 1;
      } else {
        throw new Error("Input is not a number.");
      }
    }
    return 0;
  }
  let linkEl;
  function resolveURL(path) {
    if (!linkEl)
      linkEl = document.createElement("a");
    linkEl.href = path;
    return linkEl.href;
  }
  const littleEndian = function machineIsLittleEndian() {
    const uint8Array = new Uint8Array([170, 187]);
    const uint16array = new Uint16Array(uint8Array.buffer);
    return uint16array[0] === 48042;
  }();
  function isImageBitmap(image) {
    return typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap;
  }
  function parseRange(exif) {
    const string = exif?.ImageDescription || "";
    const group = string.split(";");
    const gs = group.filter((item) => item !== "");
    return gs.map((item) => item.split(",").map((v) => parseFloat(v)));
  }
  function keysDifference(obj, other) {
    const difference = [];
    for (const i in obj) {
      if (!(i in other)) {
        difference.push(i);
      }
    }
    return difference;
  }
  function intersects(extent1, extent2) {
    return extent1[0] <= extent2[2] && extent1[2] >= extent2[0] && extent1[1] <= extent2[3] && extent1[3] >= extent2[1];
  }
  function containsExtent(extent1, extent2) {
    return extent1[0] <= extent2[0] && extent2[2] <= extent1[2] && extent1[1] <= extent2[1] && extent2[3] <= extent1[3];
  }
  function containTile(a, b) {
    return containsExtent(a, b) || intersects(a, b);
  }
  function polygon2buffer(features) {
    const len = features.length;
    let i = 0;
    const geometries = [];
    for (; i < len; i++) {
      const feature = features[i];
      const coordinates = feature.geometry.coordinates;
      const type = feature.geometry.type;
      if (type === "Polygon") {
        const polygon = earcut$1.flatten(feature.geometry.coordinates);
        const positions = new Float32Array(polygon.vertices);
        const indexData = earcut$1(polygon.vertices, polygon.holes, polygon.dimensions);
        geometries.push({
          index: {
            data: indexData.length < 65536 ? new Uint16Array(indexData) : new Uint32Array(indexData)
          },
          position: {
            data: positions,
            size: 2
          }
        });
      } else if (type === "MultiPolygon") {
        for (let k = 0; k < coordinates.length; k++) {
          const coordinate = coordinates[k];
          const polygon = earcut$1.flatten(coordinate);
          const positions = new Float32Array(polygon.vertices);
          const indexData = earcut$1(polygon.vertices, polygon.holes, polygon.dimensions);
          geometries.push({
            index: {
              data: indexData.length < 65536 ? new Uint16Array(indexData) : new Uint32Array(indexData)
            },
            position: {
              data: positions,
              size: 2
            }
          });
        }
      }
    }
    return geometries;
  }
  let ComposePass$1 = class ComposePass extends Pass {
    constructor(id, renderer, options = {}) {
      super(id, renderer, options);
      this.prerender = true;
      this.#uid = index.uid("ColorComposePass");
      this.#program = new Program(renderer, {
        vertexShader: vert$4,
        fragmentShader: frag$8,
        uniforms: {
          u_image0: {
            value: void 0
          },
          dataRange: {
            value: void 0
          }
        },
        defines: [`RENDER_TYPE ${this.options.bandType}`, `LITTLE_ENDIAN ${littleEndian}`],
        includes: shaderLib
      });
      const opt = {
        width: this.renderer.width,
        height: this.renderer.height,
        minFilter: renderer.gl.NEAREST,
        magFilter: renderer.gl.NEAREST,
        type: this.renderer.gl.FLOAT,
        format: this.renderer.gl.RGBA,
        // generateMipmaps: false,
        internalFormat: this.renderer.isWebGL2 ? this.renderer.gl.RGBA32F : this.renderer.gl.RGBA,
        stencil: true
      };
      this.#current = new RenderTarget(renderer, {
        ...opt,
        name: "currentRenderTargetTexture"
      });
      this.#next = new RenderTarget(renderer, {
        ...opt,
        name: "nextRenderTargetTexture"
      });
    }
    #program;
    #current;
    #next;
    #uid;
    resize(width, height) {
      this.#current?.resize(width, height);
      this.#next?.resize(width, height);
    }
    get renderTarget() {
      return {
        current: this.#current,
        next: this.#next
      };
    }
    get textures() {
      return {
        current: this.#current?.texture,
        next: this.#next?.texture
      };
    }
    renderTexture(renderTarget, rendererParams, rendererState, sourceCache) {
      if (renderTarget) {
        renderTarget.clear();
        renderTarget.bind();
        const attr = this.renderer.attributes;
        if (attr.depth && renderTarget.depth) {
          this.renderer.state.enable(this.renderer.gl.DEPTH_TEST);
          this.renderer.state.setDepthMask(true);
        }
        this.renderer.setViewport(renderTarget.width, renderTarget.height);
      }
      const { stencilConfigForOverlap } = this.options;
      const camera = rendererParams.cameras.camera;
      if (sourceCache) {
        const coordsAscending = sourceCache.getVisibleCoordinates();
        const coordsDescending = coordsAscending.slice().reverse();
        if (!coordsDescending.length)
          return;
        let stencil;
        if (this.maskPass) {
          stencil = this.maskPass.render(rendererParams, rendererState);
        }
        const [stencilModes, coords] = stencilConfigForOverlap(coordsDescending);
        for (let i = 0; i < coords.length; i++) {
          const coord = coords[i];
          const tile = sourceCache.getTile(coord);
          if (!(tile && tile.hasData()))
            continue;
          const bbox = coord.getTileProjBounds();
          if (!bbox)
            continue;
          const tileMesh = tile.createMesh(this.#uid, bbox, this.renderer, this.#program);
          const mesh = tileMesh.getMesh();
          const dataRange = [];
          for (const [index, texture] of tile.textures) {
            if (texture.userData?.dataRange && Array.isArray(texture.userData?.dataRange)) {
              dataRange.push(...texture.userData.dataRange);
            }
            if (this.options.isRasterize?.() && (texture.options.minFilter !== this.renderer.gl.NEAREST || texture.options.magFilter !== this.renderer.gl.NEAREST)) {
              texture.setOptions({
                minFilter: this.renderer.gl.NEAREST,
                magFilter: this.renderer.gl.NEAREST
              });
            }
            mesh.program.setUniform(`u_image${index}`, texture);
          }
          if (dataRange.length > 0) {
            mesh.program.setUniform("dataRange", dataRange);
          }
          mesh.updateMatrix();
          mesh.worldMatrixNeedsUpdate = false;
          mesh.worldMatrix.multiply(rendererParams.scene.worldMatrix, mesh.localMatrix);
          stencilModes[coord.overscaledZ];
          mesh.draw({
            ...rendererParams,
            camera
          });
          if (this.options.isRasterize?.()) {
            for (const [_, texture] of tile.textures) {
              texture.setOptions({
                minFilter: this.renderer.gl.LINEAR,
                magFilter: this.renderer.gl.LINEAR
              });
            }
          }
        }
        this.renderer.clear(false, false, true);
        if (!stencil) {
          this.renderer.state.disable(this.renderer.gl.STENCIL_TEST);
        }
      }
      if (renderTarget) {
        renderTarget.unbind();
      }
    }
    /**
     * 此处绘制主要是合并瓦片
     * @param rendererParams
     * @param rendererState
     */
    render(rendererParams, rendererState) {
      const { source } = this.options;
      const sourceCache = source.sourceCache;
      if (Array.isArray(sourceCache)) {
        if (sourceCache.length === 2) {
          this.renderTexture(this.#current, rendererParams, rendererState, sourceCache[0]);
          this.renderTexture(this.#next, rendererParams, rendererState, sourceCache[1]);
        } else {
          this.renderTexture(this.#current, rendererParams, rendererState, sourceCache[0]);
          this.renderTexture(this.#next, rendererParams, rendererState, sourceCache[0]);
        }
      } else {
        this.renderTexture(this.#current, rendererParams, rendererState, sourceCache);
        this.renderTexture(this.#next, rendererParams, rendererState, sourceCache);
      }
    }
    destroy() {
      if (this.#program) {
        this.#program.destroy();
        this.#program = null;
      }
      if (this.#current) {
        this.#current.destroy();
        this.#current = null;
      }
      if (this.#next) {
        this.#next.destroy();
        this.#next = null;
      }
    }
  };
  var vert$3 = "#define GLSLIFY 1\n#defines\nattribute vec2 uv;attribute vec3 position;uniform vec2 resolution;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
  var frag$7 = "#defines\nprecision highp float;\n#define GLSLIFY 1\nuniform sampler2D u_texture;uniform sampler2D u_textureNext;uniform sampler2D colorRampTexture;uniform float u_fade_t;uniform vec2 u_image_res;uniform vec2 colorRange;uniform bool useDisplayRange;uniform vec2 displayRange;uniform float opacity;varying vec2 vUv;\n#include <decodeFloat>\nvec4 calcTexture(const vec2 puv){vec4 color0=texture2D(u_texture,puv);vec4 color1=texture2D(u_textureNext,puv);return mix(color0,color1,u_fade_t);}\n#if RENDER_TYPE == 1\nvec2 decodeValue(const vec2 vc){vec4 rgba=calcTexture(vc);return rgba.rg;}\n#else\nfloat decodeValue(const vec2 vc){return calcTexture(vc).r;}\n#endif\n#if RENDER_TYPE == 1\nvec2 bilinear(const vec2 uv){vec2 px=1.0/u_image_res;vec2 vc=(floor(uv*u_image_res))*px;vec2 f=fract(uv*u_image_res);vec2 tl=decodeValue(vc);vec2 tr=decodeValue(vc+vec2(px.x,0));vec2 bl=decodeValue(vc+vec2(0,px.y));vec2 br=decodeValue(vc+px);return mix(mix(tl,tr,f.x),mix(bl,br,f.x),f.y);}\n#else\nfloat bilinear(const vec2 uv){vec2 px=1.0/u_image_res;vec2 vc=(floor(uv*u_image_res))*px;vec2 f=fract(uv*u_image_res);float tl=decodeValue(vc);float tr=decodeValue(vc+vec2(px.x,0));float bl=decodeValue(vc+vec2(0,px.y));float br=decodeValue(vc+px);return mix(mix(tl,tr,f.x),mix(bl,br,f.x),f.y);}\n#endif\n#if RENDER_TYPE == 1\nfloat getValue(const vec2 uv){vec2 rg=bilinear(uv);return length(rg);}\n#else\nfloat getValue(const vec2 uv){return bilinear(uv);}\n#endif\nvoid main(){vec2 uv=vUv;if(calcTexture(uv).a==0.0){discard;}float value=getValue(uv);float value_t=(value-colorRange.x)/(colorRange.y-colorRange.x);vec2 ramp_pos=vec2(value_t,0.5);vec4 color=texture2D(colorRampTexture,ramp_pos);bool display=true;if(useDisplayRange){display=value<=displayRange.y&&value>=displayRange.x;}if(display){gl_FragColor=vec4(floor(255.0*color*opacity)/255.0);}else{gl_FragColor=vec4(0.0,0.0,0.0,0.0);}}";
  class ColorizePass extends Pass {
    constructor(id, renderer, options = {}) {
      super(id, renderer, options);
      this.prerender = false;
      this.#program = new Program(renderer, {
        vertexShader: vert$3,
        fragmentShader: frag$7,
        uniforms: {
          opacity: {
            value: 1
          },
          u_fade_t: {
            value: 0
          },
          displayRange: {
            value: new Vector2(-Infinity, Infinity)
          },
          u_texture: {
            value: this.options.texture
          },
          u_textureNext: {
            value: this.options.textureNext
          },
          colorRampTexture: {
            value: null
          }
        },
        defines: [`RENDER_TYPE ${this.options.bandType}`, `LITTLE_ENDIAN ${littleEndian}`],
        includes: shaderLib,
        transparent: true
      });
      this.#geometry = new Geometry(renderer, {
        position: {
          size: 2,
          data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
        },
        uv: {
          size: 2,
          data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
        },
        index: {
          size: 1,
          data: new Uint16Array([0, 1, 2, 2, 1, 3])
        }
      });
      this.#mesh = new Mesh(renderer, {
        mode: renderer.gl.TRIANGLES,
        program: this.#program,
        geometry: this.#geometry
      });
    }
    #program;
    #mesh;
    #geometry;
    /**
     * @param rendererParams
     * @param rendererState
     */
    render(rendererParams, rendererState) {
      const attr = this.renderer.attributes;
      this.renderer.setViewport(this.renderer.width * attr.dpr, this.renderer.height * attr.dpr);
      const camera = rendererParams.cameras.planeCamera;
      if (rendererState && this.#mesh) {
        const uniforms = index.pick(rendererState, [
          "opacity",
          "colorRange",
          "dataRange",
          "colorRampTexture",
          "useDisplayRange",
          "displayRange"
        ]);
        Object.keys(uniforms).forEach((key) => {
          if (uniforms[key] !== void 0) {
            this.#mesh?.program.setUniform(key, uniforms[key]);
          }
        });
        const fade = this.options.source?.getFadeTime?.() || 0;
        this.#mesh.program.setUniform(
          "u_image_res",
          new Vector2(this.options.texture.width, this.options.texture.height)
        );
        this.#mesh.program.setUniform("u_fade_t", fade);
        this.#mesh.updateMatrix();
        this.#mesh.worldMatrixNeedsUpdate = false;
        this.#mesh.worldMatrix.multiply(camera.worldMatrix, this.#mesh.localMatrix);
        this.#mesh.draw({
          ...rendererParams,
          camera
        });
      }
    }
    destroy() {
      if (this.#mesh) {
        this.#mesh.destroy();
        this.#mesh = null;
      }
      if (this.#program) {
        this.#program.destroy();
        this.#program = null;
      }
      if (this.#geometry) {
        this.#geometry.destroy();
        this.#geometry = null;
      }
    }
  }
  var frag$6 = "precision highp float;\n#define GLSLIFY 1\nuniform sampler2D u_texture;uniform sampler2D u_textureNext;uniform float u_fade_t;uniform float opacity;varying vec2 vUv;void main(){vec2 uv=vUv;vec4 color0=texture2D(u_texture,vUv);vec4 color1=texture2D(u_textureNext,vUv);vec4 color=mix(color0,color1,u_fade_t);gl_FragColor=vec4(floor(255.0*color*opacity)/255.0);}";
  class RasterPass extends Pass {
    constructor(id, renderer, options = {}) {
      super(id, renderer, options);
      this.prerender = false;
      this.#program = new Program(renderer, {
        vertexShader: vert$3,
        fragmentShader: frag$6,
        uniforms: {
          opacity: {
            value: 1
          },
          u_fade_t: {
            value: 0
          },
          u_texture: {
            value: this.options.texture
          },
          u_textureNext: {
            value: this.options.textureNext
          }
        },
        includes: shaderLib,
        transparent: true
      });
      this.#geometry = new Geometry(renderer, {
        position: {
          size: 2,
          data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
        },
        uv: {
          size: 2,
          data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
        },
        index: {
          size: 1,
          data: new Uint16Array([0, 1, 2, 2, 1, 3])
        }
      });
      this.#mesh = new Mesh(renderer, {
        mode: renderer.gl.TRIANGLES,
        program: this.#program,
        geometry: this.#geometry
      });
    }
    #program;
    #mesh;
    #geometry;
    /**
     * @param rendererParams
     * @param rendererState
     */
    render(rendererParams, rendererState) {
      const attr = this.renderer.attributes;
      this.renderer.setViewport(this.renderer.width * attr.dpr, this.renderer.height * attr.dpr);
      const camera = rendererParams.cameras.planeCamera;
      if (rendererState && this.#mesh) {
        const fade = this.options.source?.getFadeTime?.() || 0;
        const uniforms = index.pick(rendererState, ["opacity"]);
        Object.keys(uniforms).forEach((key) => {
          if (uniforms[key] !== void 0) {
            this.#mesh?.program.setUniform(key, uniforms[key]);
          }
        });
        this.#mesh.program.setUniform("u_fade_t", fade);
        this.#mesh.updateMatrix();
        this.#mesh.worldMatrixNeedsUpdate = false;
        this.#mesh.worldMatrix.multiply(camera.worldMatrix, this.#mesh.localMatrix);
        this.#mesh.draw({
          ...rendererParams,
          camera
        });
      }
    }
    destroy() {
      if (this.#mesh) {
        this.#mesh.destroy();
        this.#mesh = null;
      }
      if (this.#program) {
        this.#program.destroy();
        this.#program = null;
      }
      if (this.#geometry) {
        this.#geometry.destroy();
        this.#geometry = null;
      }
    }
  }
  var frag$5 = "precision highp float;\n#define GLSLIFY 1\nvarying vec2 vUv;uniform sampler2D u_image0;vec4 getColor(const vec2 uv){return texture2D(u_image0,uv).rgba;}void main(){gl_FragColor=getColor(vUv);}";
  class ComposePass2 extends Pass {
    constructor(id, renderer, options = {}) {
      super(id, renderer, options);
      this.prerender = true;
      this.#uid = index.uid("ComposePass");
      this.#program = new Program(renderer, {
        vertexShader: vert$4,
        fragmentShader: frag$5,
        uniforms: {
          u_image0: {
            value: void 0
          }
        },
        includes: shaderLib
      });
      const opt = {
        width: this.renderer.width,
        height: this.renderer.height,
        minFilter: renderer.gl.NEAREST,
        magFilter: renderer.gl.NEAREST,
        type: this.renderer.gl.UNSIGNED_BYTE,
        format: this.renderer.gl.RGBA,
        generateMipmaps: true,
        internalFormat: this.renderer.gl.RGBA,
        stencil: true
      };
      this.#current = new RenderTarget(renderer, {
        ...opt,
        name: "currentRenderTargetTexture"
      });
      this.#next = new RenderTarget(renderer, {
        ...opt,
        name: "nextRenderTargetTexture"
      });
    }
    #program;
    #current;
    #next;
    #uid;
    resize(width, height) {
      this.#current?.resize(width, height);
      this.#next?.resize(width, height);
    }
    get textures() {
      return {
        current: this.#current?.texture,
        next: this.#next?.texture
      };
    }
    renderTexture(renderTarget, rendererParams, rendererState, sourceCache) {
      if (renderTarget) {
        renderTarget.clear();
        renderTarget.bind();
        const attr = this.renderer.attributes;
        if (attr.depth && renderTarget.depth) {
          this.renderer.state.enable(this.renderer.gl.DEPTH_TEST);
          this.renderer.state.setDepthMask(true);
        }
        this.renderer.setViewport(renderTarget.width, renderTarget.height);
      }
      const { stencilConfigForOverlap } = this.options;
      const camera = rendererParams.cameras.camera;
      if (sourceCache) {
        const coordsAscending = sourceCache.getVisibleCoordinates();
        const coordsDescending = coordsAscending.slice().reverse();
        if (!coordsDescending.length)
          return;
        let stencil;
        if (this.maskPass) {
          stencil = this.maskPass.render(rendererParams, rendererState);
        }
        const [stencilModes, coords] = stencilConfigForOverlap(coordsDescending);
        for (let i = 0; i < coords.length; i++) {
          const coord = coords[i];
          const tile = sourceCache.getTile(coord);
          if (!(tile && tile.hasData()))
            continue;
          const bbox = coord.getTileProjBounds();
          if (!bbox)
            continue;
          const tileMesh = tile.createMesh(this.#uid, bbox, this.renderer, this.#program);
          const mesh = tileMesh.getMesh();
          for (const [index, texture] of tile.textures) {
            mesh.program.setUniform(`u_image${index}`, texture);
          }
          mesh.updateMatrix();
          mesh.worldMatrixNeedsUpdate = false;
          mesh.worldMatrix.multiply(rendererParams.scene.worldMatrix, mesh.localMatrix);
          stencilModes[coord.overscaledZ];
          mesh.draw({
            ...rendererParams,
            camera
          });
        }
        this.renderer.clear(false, false, true);
        if (!stencil) {
          this.renderer.state.disable(this.renderer.gl.STENCIL_TEST);
        }
      }
      if (renderTarget) {
        renderTarget.unbind();
      }
    }
    /**
     * 此处绘制主要是合并瓦片
     * @param rendererParams
     * @param rendererState
     */
    render(rendererParams, rendererState) {
      const { source } = this.options;
      const sourceCache = source.sourceCache;
      if (Array.isArray(sourceCache)) {
        if (sourceCache.length === 2) {
          this.renderTexture(this.#current, rendererParams, rendererState, sourceCache[0]);
          this.renderTexture(this.#next, rendererParams, rendererState, sourceCache[1]);
        } else {
          this.renderTexture(this.#current, rendererParams, rendererState, sourceCache[0]);
        }
      } else {
        this.renderTexture(this.#current, rendererParams, rendererState, sourceCache);
      }
    }
    destroy() {
      if (this.#current) {
        this.#current.destroy();
        this.#current = null;
      }
      if (this.#next) {
        this.#next.destroy();
        this.#next = null;
      }
      if (this.#program) {
        this.#program.destroy();
        this.#program = null;
      }
    }
  }
  const defaultSize = 256;
  class ParticlesComposePass extends Pass {
    constructor(id, renderer, options = {}) {
      super(id, renderer, options);
      this.prerender = true;
      this.#width = defaultSize;
      this.#height = defaultSize;
      this.#uid = options.id;
      this.#program = new Program(renderer, {
        vertexShader: vert$3,
        fragmentShader: frag$8,
        uniforms: {
          u_image0: {
            value: void 0
          },
          dataRange: {
            value: void 0
          }
        },
        defines: [`RENDER_TYPE ${this.options.bandType}`, `LITTLE_ENDIAN ${littleEndian}`],
        includes: shaderLib
      });
      const opt = {
        width: this.#width,
        height: this.#height,
        minFilter: renderer.gl.NEAREST,
        magFilter: renderer.gl.NEAREST,
        type: this.renderer.gl.FLOAT,
        format: this.renderer.gl.RGBA,
        // generateMipmaps: false,
        internalFormat: this.renderer.isWebGL2 ? this.renderer.gl.RGBA32F : this.renderer.gl.RGBA,
        stencil: true
      };
      this.#current = new RenderTarget(renderer, {
        ...opt,
        name: "currentRenderTargetTexture"
      });
      this.#next = new RenderTarget(renderer, {
        ...opt,
        name: "nextRenderTargetTexture"
      });
    }
    #program;
    #current;
    #next;
    #uid;
    #width;
    #height;
    resize(width, height) {
      if (width !== this.#width || height !== this.#height) {
        this.#current?.resize(width, height);
        this.#next?.resize(width, height);
        this.#width = width;
        this.#height = height;
      }
    }
    get textures() {
      return {
        current: this.#current?.texture,
        next: this.#next?.texture
      };
    }
    renderTexture(renderTarget, rendererParams, rendererState, sourceCache) {
      if (!sourceCache) {
        return;
      }
      const { stencilConfigForOverlap } = this.options;
      const camera = rendererParams.cameras.planeCamera;
      const coordsAscending = sourceCache.getVisibleCoordinates();
      const coordsDescending = coordsAscending.slice().reverse();
      if (!coordsDescending.length)
        return;
      let xmin = Infinity;
      let ymin = Infinity;
      let xmax = -Infinity;
      let ymax = -Infinity;
      let zmin = Infinity;
      let zmax = -Infinity;
      for (let n = 0; n < coordsDescending.length; n++) {
        const tileId = coordsDescending[n];
        const bounds = tileId.getTileProjBounds();
        xmin = Math.min(bounds.left, xmin);
        xmax = Math.max(bounds.right, xmax);
        zmin = Math.min(tileId.z, zmin);
        zmax = Math.max(tileId.z, zmax);
        if (!rendererState.u_flip_y) {
          ymin = Math.min(bounds.top, ymin);
          ymax = Math.max(bounds.bottom, ymax);
        } else {
          ymin = Math.min(bounds.bottom, ymin);
          ymax = Math.max(bounds.top, ymax);
        }
      }
      const zz = this.options.getTileProjSize(zmax, coordsDescending);
      const dx = xmax - xmin;
      const dy = ymax - ymin;
      const w = dx / zz[0];
      const h = dy / zz[1];
      rendererState.sharedState.u_data_bbox = [xmin, ymin, xmax, ymax];
      rendererState.sharedState.u_data_zooms = [zmin, zmax];
      if (renderTarget) {
        renderTarget.clear();
        renderTarget.bind();
        const attr = this.renderer.attributes;
        if (attr.depth && renderTarget.depth) {
          this.renderer.state.enable(this.renderer.gl.DEPTH_TEST);
          this.renderer.state.setDepthMask(true);
        }
        let width = w * (this.options.source.tileSize ?? defaultSize);
        let height = h * (this.options.source.tileSize ?? defaultSize);
        rendererState.sharedState.u_tiles_size = [width, height];
        const maxTextureSize = this.renderer.gl.getParameter(this.renderer.gl.MAX_TEXTURE_SIZE) * 0.5;
        const maxRenderBufferSize = this.renderer.gl.getParameter(this.renderer.gl.MAX_RENDERBUFFER_SIZE) * 0.5;
        const maxSize = Math.max(width, height);
        if (maxSize > maxTextureSize) {
          width = maxTextureSize / maxSize * width;
          height = maxTextureSize / maxSize * height;
        } else if (maxSize > maxRenderBufferSize) {
          width = maxRenderBufferSize / maxSize * width;
          height = maxRenderBufferSize / maxSize * height;
        }
        this.resize(width, height);
        this.renderer.setViewport(width, height);
      }
      const [stencilModes, coords] = stencilConfigForOverlap(coordsDescending);
      for (let k = 0; k < coords.length; k++) {
        const coord = coords[k];
        if (coord) {
          const tile = sourceCache.getTile(coord);
          if (!(tile && tile.hasData()))
            continue;
          const tileBBox = coord.getTileProjBounds();
          if (!tileBBox)
            continue;
          const tileMesh = tile.createMesh(this.#uid, tileBBox, this.renderer, this.#program);
          const mesh = tileMesh.planeMesh;
          const scale = Math.pow(2, zmax - coord.z);
          mesh.scale.set(1 / w * scale, 1 / h * scale, 1);
          if (!rendererState.u_flip_y) {
            mesh.position.set((tileBBox.left - xmin) / dx, (tileBBox.top - ymin) / dy, 0);
          } else {
            mesh.position.set((tileBBox.left - xmin) / dx, 1 - (tileBBox.top - ymin) / dy, 0);
          }
          const dataRange = [];
          for (const [index, texture] of tile.textures) {
            if (texture.userData?.dataRange && Array.isArray(texture.userData?.dataRange)) {
              dataRange.push(...texture.userData.dataRange);
            }
            mesh.program.setUniform(`u_image${index}`, texture);
          }
          if (dataRange.length > 0) {
            mesh.program.setUniform("dataRange", dataRange);
          }
          mesh.updateMatrix();
          mesh.worldMatrixNeedsUpdate = false;
          mesh.worldMatrix.multiply(camera.worldMatrix, mesh.localMatrix);
          const stencilMode = stencilModes[coord.overscaledZ];
          if (stencilMode) {
            if (stencilMode.stencil) {
              this.renderer.state.enable(this.renderer.gl.STENCIL_TEST);
              this.renderer.state.setStencilFunc(stencilMode.func?.cmp, stencilMode.func?.ref, stencilMode.func?.mask);
              this.renderer.state.setStencilOp(stencilMode.op?.fail, stencilMode.op?.zfail, stencilMode.op?.zpass);
            } else {
              this.renderer.state.disable(this.renderer.gl.STENCIL_TEST);
            }
          }
          mesh.draw({
            ...rendererParams,
            camera
          });
        }
      }
      if (renderTarget) {
        renderTarget.unbind();
      }
    }
    /**
     * 此处绘制主要是合并瓦片
     * @param rendererParams
     * @param rendererState
     */
    render(rendererParams, rendererState) {
      const { source } = this.options;
      const sourceCache = source.sourceCache;
      if (Array.isArray(sourceCache)) {
        if (sourceCache.length === 2) {
          this.renderTexture(this.#current, rendererParams, rendererState, sourceCache[0]);
          this.renderTexture(this.#next, rendererParams, rendererState, sourceCache[1]);
        } else {
          this.renderTexture(this.#current, rendererParams, rendererState, sourceCache[0]);
          this.renderTexture(this.#next, rendererParams, rendererState, sourceCache[0]);
        }
      } else {
        this.renderTexture(this.#current, rendererParams, rendererState, sourceCache);
        this.renderTexture(this.#next, rendererParams, rendererState, sourceCache);
      }
    }
    destroy() {
      if (this.#program) {
        this.#program.destroy();
        this.#program = null;
      }
      if (this.#current) {
        this.#current.destroy();
        this.#current = null;
      }
      if (this.#next) {
        this.#next.destroy();
        this.#next = null;
      }
    }
  }
  var frag$4 = "#defines\nprecision highp float;\n#define GLSLIFY 1\nuniform sampler2D u_texture;uniform sampler2D u_textureNext;uniform sampler2D u_particles;uniform float u_fade_t;uniform vec2 u_image_res;uniform vec4 u_bbox;uniform vec4 u_data_bbox;uniform float u_rand_seed;uniform float u_drop_rate;uniform float u_drop_rate_bump;uniform float u_speed_factor;uniform bool u_initialize;uniform bool u_flip_y;uniform float u_gl_scale;varying vec2 vUv;\n#include <random>\nvec4 calcTexture(const vec2 puv){vec4 color0=texture2D(u_texture,puv);vec4 color1=texture2D(u_textureNext,puv);return mix(color0,color1,u_fade_t);}vec2 decodeValue(const vec2 vc){vec4 rgba=calcTexture(vc);return rgba.rg;}vec2 bilinear(const vec2 uv){vec2 px=1.0/u_image_res;vec2 vc=(floor(uv*u_image_res))*px;vec2 f=fract(uv*u_image_res);vec2 tl=decodeValue(vc);vec2 tr=decodeValue(vc+vec2(px.x,0));vec2 bl=decodeValue(vc+vec2(0,px.y));vec2 br=decodeValue(vc+px);return mix(mix(tl,tr,f.x),mix(bl,br,f.x),f.y);}vec2 randomPosToGlobePos(vec2 pos){vec2 min_bbox=u_bbox.xy;vec2 max_bbox=u_bbox.zw;return mix(min_bbox,max_bbox,pos);}bool containsXY(vec2 pos,vec4 bbox){float x=pos.x;return(bbox.x<=x&&x<=bbox.z&&bbox.y<=pos.y&&pos.y<=bbox.w);}vec2 update(vec2 pos){vec2 uv=(pos.xy-u_data_bbox.xy)/(u_data_bbox.zw-u_data_bbox.xy);if(u_flip_y){uv=vec2(uv.x,1.0-uv.y);}vec2 velocity=bilinear(uv);float speed=length(velocity);vec2 v=vec2(velocity.x,-velocity.y);if(u_flip_y){v=vec2(velocity.x,velocity.y);}vec2 offset=v*0.0001*u_speed_factor*u_gl_scale;pos=pos+offset;vec2 seed=(pos.xy+vUv)*u_rand_seed;float drop_rate=u_drop_rate+speed*u_drop_rate_bump;float drop=step(1.0-drop_rate,rand(seed));vec2 random_pos=vec2(rand(seed+1.3),rand(seed+2.1));random_pos=randomPosToGlobePos(random_pos);if(!containsXY(pos.xy,u_data_bbox)||!containsXY(pos.xy,u_bbox)||calcTexture(uv).a==0.0){drop=1.0;}pos=mix(pos,random_pos,drop);return pos;}void main(){vec2 pos=texture2D(u_particles,vUv).xy;pos=update(pos);if(u_initialize){pos=randomPosToGlobePos(pos);for(int i=0;i<25;i++){pos=update(pos);}}gl_FragColor=vec4(pos.xy,0.0,1.0);}";
  class UpdatePass extends Pass {
    constructor(id, renderer, options = {}) {
      super(id, renderer, options);
      this.prerender = true;
      this.#initialize = true;
      this.initializeRenderTarget();
      this.#program = new Program(renderer, {
        vertexShader: vert$3,
        fragmentShader: frag$4,
        uniforms: {
          u_fade_t: {
            value: 0
          },
          displayRange: {
            value: new Vector2(-Infinity, Infinity)
          },
          u_texture: {
            value: this.options.texture
          },
          u_textureNext: {
            value: this.options.textureNext
          },
          u_particles: {
            value: null
          }
        },
        defines: [`RENDER_TYPE ${this.options.bandType}`, `LITTLE_ENDIAN ${littleEndian}`],
        includes: shaderLib,
        blending: BlendType.NoBlending,
        transparent: true
      });
      this.#geometry = new Geometry(renderer, {
        position: {
          size: 2,
          data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
        },
        uv: {
          size: 2,
          data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
        },
        index: {
          size: 1,
          data: new Uint16Array([0, 1, 2, 2, 1, 3])
        }
      });
      this.#mesh = new Mesh(renderer, {
        mode: renderer.gl.TRIANGLES,
        program: this.#program,
        geometry: this.#geometry
      });
    }
    #program;
    #mesh;
    #geometry;
    #current;
    #next;
    #initialize;
    #particleRes;
    #getParticleRes() {
      return Math.ceil(Math.sqrt(this.options.getParticleNumber()));
    }
    resize() {
      const particleRes = this.#getParticleRes();
      this.#current?.resize(particleRes, particleRes);
      this.#next?.resize(particleRes, particleRes);
    }
    get textures() {
      return {
        currentParticles: this.#current?.texture,
        nextParticles: this.#next?.texture
      };
    }
    setInitialize(state) {
      this.#initialize = state;
    }
    /**
     * 创建 RenderTarget
     */
    initializeRenderTarget() {
      const particleRes = this.#getParticleRes();
      const particleState = new Float32Array(particleRes ** 2 * 4);
      const s = this.options.glScale;
      for (let i = 0; i < particleState.length; i++) {
        particleState[i] = Math.random() * s;
      }
      const opt = {
        data: particleState,
        width: particleRes,
        height: particleRes,
        minFilter: this.renderer.gl.NEAREST,
        magFilter: this.renderer.gl.NEAREST,
        type: this.renderer.gl.FLOAT,
        format: this.renderer.gl.RGBA,
        internalFormat: this.renderer.isWebGL2 ? this.renderer.gl.RGBA32F : this.renderer.gl.RGBA,
        stencil: false
      };
      this.#current = new RenderTarget(this.renderer, {
        ...opt,
        name: "currentUpdateTexture"
      });
      this.#next = new RenderTarget(this.renderer, {
        ...opt,
        name: "nextUpdateTexture"
      });
    }
    /**
     * 交换 RenderTarget
     */
    swapRenderTarget() {
      [this.#current, this.#next] = [this.#next, this.#current];
    }
    /**
     * @param rendererParams
     * @param rendererState
     */
    render(rendererParams, rendererState) {
      const attr = this.renderer.attributes;
      const camera = rendererParams.cameras.planeCamera;
      const particleRes = this.#getParticleRes();
      if (!this.#particleRes || this.#particleRes !== particleRes) {
        this.#particleRes = particleRes;
        this.initializeRenderTarget();
      }
      if (this.#next) {
        this.#next.bind();
        if (attr.depth && this.#next.depth) {
          this.renderer.state.enable(this.renderer.gl.DEPTH_TEST);
          this.renderer.state.setDepthMask(true);
        }
        this.renderer.setViewport(this.#next.width, this.#next.height);
      }
      if (rendererState && this.#mesh) {
        const uniforms = index.pick(rendererState, [
          "dataRange",
          "useDisplayRange",
          "displayRange",
          "u_drop_rate",
          "u_drop_rate_bump",
          "u_speed_factor",
          "u_flip_y",
          "u_gl_scale"
        ]);
        Object.keys(uniforms).forEach((key) => {
          if (uniforms[key] !== void 0) {
            this.#mesh?.program.setUniform(key, uniforms[key]);
          }
        });
        const fade = this.options.source?.getFadeTime?.() || 0;
        this.#mesh.program.setUniform(
          "u_image_res",
          new Vector2(this.options.texture.width, this.options.texture.height)
        );
        this.#mesh.program.setUniform("u_fade_t", fade);
        this.#mesh.program.setUniform("u_rand_seed", Math.random());
        this.#mesh.program.setUniform("u_particles", this.#current?.texture);
        this.#mesh.program.setUniform("u_bbox", rendererState.extent);
        this.#mesh.program.setUniform("u_initialize", this.#initialize);
        this.#mesh.program.setUniform("u_data_bbox", rendererState.sharedState.u_data_bbox);
        this.#mesh.updateMatrix();
        this.#mesh.worldMatrixNeedsUpdate = false;
        this.#mesh.worldMatrix.multiply(camera.worldMatrix, this.#mesh.localMatrix);
        this.#mesh.draw({
          ...rendererParams,
          camera
        });
      }
      if (this.#next) {
        this.#next.unbind();
      }
      this.#initialize = false;
      this.swapRenderTarget();
    }
    destroy() {
      if (this.#mesh) {
        this.#mesh.destroy();
        this.#mesh = null;
      }
      if (this.#program) {
        this.#program.destroy();
        this.#program = null;
      }
      if (this.#geometry) {
        this.#geometry.destroy();
        this.#geometry = null;
      }
      if (this.#current) {
        this.#current.destroy();
        this.#current = null;
      }
      if (this.#next) {
        this.#next.destroy();
        this.#next = null;
      }
    }
  }
  var frag$3 = "precision highp float;\n#define GLSLIFY 1\nuniform sampler2D u_screen;uniform float u_opacity;uniform float u_fade;varying vec2 vUv;void main(){vec4 color=texture2D(u_screen,vUv);gl_FragColor=vec4(floor(255.0*color*u_opacity*u_fade)/255.0);}";
  class ScreenPass extends Pass {
    #program;
    #mesh;
    #geometry;
    constructor(id, renderer, options = {}) {
      super(id, renderer, options);
      this.prerender = Boolean(options.prerender);
      this.#program = new Program(renderer, {
        vertexShader: vert$3,
        fragmentShader: frag$3,
        uniforms: {
          opacity: {
            value: 1
          },
          u_fade: {
            value: 1
          },
          u_screen: {
            value: null
          }
        },
        defines: [`RENDER_TYPE ${this.options.bandType}`, `LITTLE_ENDIAN ${littleEndian}`],
        includes: shaderLib,
        transparent: true,
        blending: options.enableBlend ? BlendType.CustomBlending : BlendType.NoBlending,
        blendFunc: {
          src: this.renderer.gl.ONE,
          dst: this.renderer.gl.ONE_MINUS_SRC_ALPHA
        },
        blendEquation: {
          modeAlpha: this.renderer.gl.FUNC_ADD,
          modeRGB: this.renderer.gl.FUNC_ADD
        }
      });
      this.#geometry = new Geometry(renderer, {
        position: {
          size: 2,
          data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
        },
        uv: {
          size: 2,
          data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
        },
        index: {
          size: 1,
          data: new Uint16Array([0, 1, 2, 2, 1, 3])
        }
      });
      this.#mesh = new Mesh(renderer, {
        mode: renderer.gl.TRIANGLES,
        program: this.#program,
        geometry: this.#geometry
      });
    }
    get renderTarget() {
      if (this.options.particlesPass && this.prerender) {
        return this.options.particlesPass.renderTarget;
      }
    }
    /**
     * @param rendererParams
     * @param rendererState
     */
    render(rendererParams, rendererState) {
      if (this.renderTarget) {
        this.renderTarget.bind();
        this.renderer.setViewport(this.renderTarget.width, this.renderTarget.height);
      } else {
        const attr = this.renderer.attributes;
        this.renderer.setViewport(this.renderer.width * attr.dpr, this.renderer.height * attr.dpr);
      }
      if (rendererState && this.#mesh) {
        const camera = rendererParams.cameras.planeCamera;
        this.#mesh.program.setUniform("u_fade", 1);
        this.#mesh.program.setUniform("u_opacity", this.prerender ? rendererState.fadeOpacity : rendererState.opacity);
        this.#mesh.program.setUniform(
          "u_screen",
          this.prerender ? this.options.particlesPass?.textures.backgroundTexture : this.options.particlesPass?.textures.screenTexture
        );
        this.#mesh.updateMatrix();
        this.#mesh.worldMatrixNeedsUpdate = false;
        this.#mesh.worldMatrix.multiply(camera.worldMatrix, this.#mesh.localMatrix);
        this.#mesh.draw({
          ...rendererParams,
          camera
        });
      }
      if (this.renderTarget) {
        this.renderTarget.unbind();
      }
      if (this.options.particlesPass && !this.prerender) {
        this.options.particlesPass?.swapRenderTarget();
      }
    }
    destroy() {
      if (this.#mesh) {
        this.#mesh.destroy();
        this.#mesh = null;
      }
      if (this.#program) {
        this.#program.destroy();
        this.#program = null;
      }
      if (this.#geometry) {
        this.#geometry.destroy();
        this.#geometry = null;
      }
    }
  }
  var vert$2 = "#define GLSLIFY 1\nattribute vec2 reference;attribute float a_index;uniform vec2 resolution;uniform mat4 modelViewMatrix;uniform mat4 viewMatrix;uniform mat4 modelMatrix;uniform mat4 projectionMatrix;uniform sampler2D u_particles;uniform sampler2D u_particles_next;uniform float u_particleSize;uniform float u_particlesRes;varying vec2 v_particle_pos;void main(){float v_index=floor(a_index/6.0);vec2 uv=reference;vec4 color=texture2D(u_particles,uv);vec4 color1=texture2D(u_particles_next,uv);v_particle_pos=mix(color.rg,color1.rg,0.0);gl_PointSize=u_particleSize;gl_Position=projectionMatrix*modelViewMatrix*vec4(v_particle_pos,0.0,1.0);}";
  var frag$2 = "#defines\nprecision highp float;\n#define GLSLIFY 1\nuniform sampler2D u_texture;uniform sampler2D u_textureNext;uniform vec2 u_colorRange;uniform sampler2D u_colorRamp;uniform vec4 u_bbox;uniform vec4 u_data_bbox;uniform float u_fade_t;uniform vec2 u_image_res;varying vec2 v_particle_pos;vec4 calcTexture(const vec2 puv){vec4 color0=texture2D(u_texture,puv);vec4 color1=texture2D(u_textureNext,puv);return mix(color0,color1,u_fade_t);}\n#if RENDER_TYPE == 1\nvec2 decodeValue(const vec2 vc){vec4 rgba=calcTexture(vc);return rgba.rg;}\n#else\nfloat decodeValue(const vec2 vc){return calcTexture(vc).r;}\n#endif\nvec2 bilinear(const vec2 uv){vec2 px=1.0/u_image_res;vec2 vc=(floor(uv*u_image_res))*px;vec2 f=fract(uv*u_image_res);vec2 tl=decodeValue(vc);vec2 tr=decodeValue(vc+vec2(px.x,0));vec2 bl=decodeValue(vc+vec2(0,px.y));vec2 br=decodeValue(vc+px);return mix(mix(tl,tr,f.x),mix(bl,br,f.x),f.y);}bool containsXY(vec2 pos,vec4 bbox){float x=pos.x;return(bbox.x<x&&x<bbox.z&&bbox.y<pos.y&&pos.y<bbox.w);}void main(){vec2 pos=v_particle_pos;if(!containsXY(pos.xy,u_data_bbox)||!containsXY(pos.xy,u_bbox)||calcTexture(pos).a==0.0){discard;}vec2 velocity=bilinear(pos);float value=length(velocity);float value_t=(value-u_colorRange.x)/(u_colorRange.y-u_colorRange.x);vec2 ramp_pos=vec2(value_t,0.5);vec4 color=texture2D(u_colorRamp,ramp_pos);float distance=length(2.0*gl_PointCoord-1.0);if(distance>1.0){discard;}gl_FragColor=vec4(floor(255.0*color*color.a)/255.0);}";
  class Particles extends Pass {
    #prerender = true;
    #privateNumParticles;
    #program;
    #mesh;
    #geometry;
    #screenTexture;
    #backgroundTexture;
    constructor(id, renderer, options = {}) {
      super(id, renderer, options);
      this.initializeRenderTarget();
      this.#program = new Program(renderer, {
        vertexShader: vert$2,
        fragmentShader: frag$2,
        uniforms: {
          u_fade_t: {
            value: 0
          },
          displayRange: {
            value: new Vector2(-Infinity, Infinity)
          },
          u_texture: {
            value: this.options.texture
          },
          u_textureNext: {
            value: this.options.textureNext
          },
          u_particles: {
            value: null
          },
          u_particleSize: {
            value: 2
          },
          u_particlesRes: {
            value: 0
          }
        },
        defines: [`RENDER_TYPE ${this.options.bandType}`, `LITTLE_ENDIAN ${littleEndian}`],
        includes: shaderLib,
        transparent: true,
        blending: BlendType.NoBlending,
        blendFunc: {
          src: this.renderer.gl.ONE,
          dst: this.renderer.gl.ONE_MINUS_SRC_ALPHA
        },
        blendEquation: {
          modeAlpha: this.renderer.gl.FUNC_ADD,
          modeRGB: this.renderer.gl.FUNC_ADD
        }
      });
      const { particleIndices, particleReferences } = this.getParticleBuffer();
      this.#geometry = new Geometry(renderer, {
        a_index: {
          size: 1,
          data: particleIndices
        },
        reference: {
          size: 2,
          data: particleReferences
        }
      });
      this.#mesh = new Mesh(renderer, {
        mode: renderer.gl.POINTS,
        program: this.#program,
        geometry: this.#geometry
      });
    }
    get prerender() {
      return this.#prerender;
    }
    set prerender(prerender) {
      this.#prerender = prerender;
    }
    get textures() {
      return {
        screenTexture: this.#screenTexture?.texture,
        backgroundTexture: this.#backgroundTexture?.texture
      };
    }
    get renderTarget() {
      return this.#prerender && this.#screenTexture;
    }
    resetParticles() {
      this.#screenTexture?.clear();
      this.#backgroundTexture?.clear();
    }
    getParticleBuffer() {
      const particleRes = Math.ceil(Math.sqrt(this.options.getParticleNumber()));
      this.particleStateResolution = particleRes;
      this.#privateNumParticles = particleRes * particleRes;
      const indexCount = this.#privateNumParticles;
      const particleIndices = new Float32Array(indexCount);
      const particleReferences = new Float32Array(indexCount * 2);
      for (let i = 0; i < indexCount; i++) {
        const t = i % particleRes / particleRes;
        const a = Math.trunc(i / particleRes) / particleRes;
        particleReferences.set([t, a], 2 * i);
        particleIndices[i] = i;
      }
      return { particleIndices, particleReferences };
    }
    /**
     * 创建 RenderTarget
     */
    initializeRenderTarget() {
      const opt = {
        width: this.renderer.width,
        height: this.renderer.height,
        minFilter: this.renderer.gl.LINEAR,
        magFilter: this.renderer.gl.LINEAR,
        type: this.renderer.gl.UNSIGNED_BYTE,
        format: this.renderer.gl.RGBA,
        stencil: true,
        premultipliedAlpha: false
      };
      this.#screenTexture = new RenderTarget(this.renderer, {
        ...opt,
        name: "screenTexture"
      });
      this.#backgroundTexture = new RenderTarget(this.renderer, {
        ...opt,
        name: "backgroundTexture"
      });
    }
    /**
     * 交换 RenderTarget
     */
    swapRenderTarget() {
      [this.#screenTexture, this.#backgroundTexture] = [this.#backgroundTexture, this.#screenTexture];
    }
    /**
     * @param rendererParams
     * @param rendererState
     */
    render(rendererParams, rendererState) {
      if (this.renderTarget) {
        this.renderTarget.bind();
        this.renderer.setViewport(this.renderTarget.width, this.renderTarget.height);
      } else {
        const attr = this.renderer.attributes;
        this.renderer.setViewport(this.renderer.width * attr.dpr, this.renderer.height * attr.dpr);
      }
      const { camera } = rendererParams.cameras;
      let stencil;
      if (this.maskPass) {
        stencil = this.maskPass.render(rendererParams, rendererState);
      }
      if (rendererState && this.#mesh) {
        this.#mesh.program.setUniform(
          "u_image_res",
          new Vector2(this.options.texture.width, this.options.texture.height)
        );
        const fade = this.options.source?.getFadeTime?.() || 0;
        this.#mesh.program.setUniform("u_fade_t", fade);
        this.#mesh.program.setUniform("u_colorRamp", rendererState.colorRampTexture);
        this.#mesh.program.setUniform("u_colorRange", rendererState.colorRange);
        const particleTextures = this.options.getParticles();
        this.#mesh.program.setUniform("u_particles", particleTextures.currentParticles);
        this.#mesh.program.setUniform("u_particles_next", particleTextures.nextParticles);
        this.#mesh.program.setUniform("u_particlesRes", this.#privateNumParticles);
        const sharedState = rendererState.sharedState;
        this.#mesh.program.setUniform("u_bbox", rendererState.extent);
        this.#mesh.program.setUniform("u_data_bbox", sharedState.u_data_bbox);
        this.#mesh.program.setUniform("u_flip_y", rendererState.u_flip_y);
        this.#mesh.program.setUniform("u_gl_scale", rendererState.u_gl_scale);
        this.#mesh.updateMatrix();
        this.#mesh.worldMatrixNeedsUpdate = false;
        this.#mesh.worldMatrix.multiply(rendererParams.scene.worldMatrix, this.#mesh.localMatrix);
        this.#mesh.draw({
          ...rendererParams,
          camera
        });
      }
      if (!stencil) {
        this.renderer.state.disable(this.renderer.gl.STENCIL_TEST);
      }
      if (this.renderTarget) {
        this.renderTarget.unbind();
      }
    }
    destroy() {
      if (this.#mesh) {
        this.#mesh.destroy();
        this.#mesh = null;
      }
      if (this.#program) {
        this.#program.destroy();
        this.#program = null;
      }
      if (this.#geometry) {
        this.#geometry.destroy();
        this.#geometry = null;
      }
      if (this.#screenTexture) {
        this.#screenTexture.destroy();
        this.#screenTexture = null;
      }
      if (this.#backgroundTexture) {
        this.#backgroundTexture.destroy();
        this.#backgroundTexture = null;
      }
    }
  }
  var vert$1 = "#define GLSLIFY 1\n#defines\nattribute vec2 uv;attribute vec3 position;uniform vec2 resolution;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;varying vec2 vUv;void main(){vUv=vec2(uv.x,1.0-uv.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
  var frag$1 = "precision highp float;\n#define GLSLIFY 1\nuniform sampler2D u_texture;uniform sampler2D u_textureNext;uniform float u_fade_t;varying vec2 vUv;void main(){vec2 uv=vUv;vec4 color0=texture2D(u_texture,vUv);vec4 color1=texture2D(u_textureNext,vUv);vec4 color=mix(color0,color1,u_fade_t);gl_FragColor=color;}";
  class PickerPass extends Pass {
    constructor(id, renderer, options = {}) {
      super(id, renderer, options);
      this.prerender = true;
      this.#program = new Program(renderer, {
        vertexShader: vert$1,
        fragmentShader: frag$1,
        uniforms: {
          u_fade_t: {
            value: 0
          },
          u_texture: {
            value: this.options.texture
          },
          u_textureNext: {
            value: this.options.textureNext
          }
        },
        includes: shaderLib,
        transparent: true
      });
      this.#geometry = new Geometry(renderer, {
        position: {
          size: 2,
          data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
        },
        uv: {
          size: 2,
          data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
        },
        index: {
          size: 1,
          data: new Uint16Array([0, 1, 2, 2, 1, 3])
        }
      });
      this.#mesh = new Mesh(renderer, {
        mode: renderer.gl.TRIANGLES,
        program: this.#program,
        geometry: this.#geometry
      });
      const opt = {
        width: this.renderer.width,
        height: this.renderer.height,
        minFilter: renderer.gl.NEAREST,
        magFilter: renderer.gl.NEAREST,
        type: this.renderer.gl.UNSIGNED_BYTE,
        format: this.renderer.gl.RGBA,
        generateMipmaps: true,
        internalFormat: this.renderer.gl.RGBA,
        stencil: false
      };
      if (options.useFloatTexture) {
        opt.type = this.renderer.gl.FLOAT;
        opt.internalFormat = this.renderer.isWebGL2 ? this.renderer.gl.RGBA32F : this.renderer.gl.RGBA;
      }
      this.#picker = new RenderTarget(renderer, {
        ...opt,
        name: "pickerRenderTargetTexture"
      });
    }
    #program;
    #mesh;
    #geometry;
    #picker;
    #rendererParams;
    #rendererState;
    resize(width, height) {
      this.#picker?.resize(width, height);
    }
    /**
     * @param rendererParams
     * @param rendererState
     * @param pixel
     */
    render(rendererParams = this.#rendererParams, rendererState = this.#rendererState, pixel) {
      return new Promise((resolve) => {
        if (!this.#picker || !this.#mesh)
          return resolve(null);
        this.#rendererParams = this.#rendererParams !== rendererParams ? rendererParams : this.#rendererParams;
        this.#rendererState = this.#rendererState !== rendererState ? rendererState : this.#rendererState;
        const camera = rendererParams.cameras.planeCamera;
        this.#picker.clear();
        this.#picker.bind();
        this.renderer.setViewport(this.#picker.width, this.#picker.height);
        if (rendererState) {
          const fade = this.options.source?.getFadeTime?.() || 0;
          this.#mesh.program.setUniform("u_fade_t", fade);
          this.#mesh.updateMatrix();
          this.#mesh.worldMatrixNeedsUpdate = false;
          this.#mesh.worldMatrix.multiply(camera.worldMatrix, this.#mesh.localMatrix);
          this.#mesh.draw({
            ...rendererParams,
            camera
          });
          if (pixel) {
            const a = this.options.useFloatTexture ? new Float32Array(4) : new Uint8Array(4);
            this.renderer.gl.readPixels(
              pixel[0],
              pixel[1],
              1,
              1,
              this.renderer.gl.RGBA,
              this.options.useFloatTexture ? this.renderer.gl.FLOAT : this.renderer.gl.UNSIGNED_BYTE,
              a
            );
            resolve(a);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
        this.#picker.unbind();
      });
    }
    destroy() {
      if (this.#mesh) {
        this.#mesh.destroy();
        this.#mesh = null;
      }
      if (this.#program) {
        this.#program.destroy();
        this.#program = null;
      }
      if (this.#geometry) {
        this.#geometry.destroy();
        this.#geometry = null;
      }
      if (this.#picker) {
        this.#picker.destroy();
        this.#picker = null;
      }
    }
  }
  function parseColorStyle(styleAttrField) {
    if (Array.isArray(styleAttrField) && styleAttrField.length > 3) {
      const type = styleAttrField[0];
      const action = styleAttrField[1];
      const interpolateColor = [];
      for (let i = 3; i < styleAttrField.length; i += 2) {
        const val = styleAttrField[i];
        const color = styleAttrField[i + 1];
        interpolateColor.push({
          key: val,
          value: color
        });
      }
      return {
        operator: type,
        interpolation: {
          name: action[0],
          base: action[1]
        },
        input: interpolateColor
      };
    } else {
      console.warn("[wind-core]: style-parser style config invalid");
      return {};
    }
  }
  function parseZoomStyle(styleAttrField) {
    if (Array.isArray(styleAttrField) && styleAttrField.length > 3) {
      const type = styleAttrField[0];
      const action = styleAttrField[1];
      const interpolateZoom = [];
      for (let i = 3; i < styleAttrField.length; i += 2) {
        const val = styleAttrField[i];
        const color = styleAttrField[i + 1];
        interpolateZoom.push({
          key: val,
          value: color
        });
      }
      return {
        operator: type,
        interpolation: {
          name: action[0],
          base: action[1]
        },
        input: interpolateZoom
      };
    } else {
      console.warn("[wind-core]: style-parser style config invalid");
      return {};
    }
  }
  function createGradient(interpolateColor, min, max, w, h, gradient, ctx) {
    for (let i = 0; i < interpolateColor.length; i += 1) {
      const key = interpolateColor[i].key;
      const color = interpolateColor[i].value;
      gradient.addColorStop((key - min) / (max - min), color);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
  function createStepGradient(interpolateColor, min, max, w, h, ctx) {
    for (let i = 0; i < interpolateColor.length; i += 1) {
      const key = interpolateColor[i].key;
      let keyNext = key;
      if (i < interpolateColor.length - 1) {
        keyNext = interpolateColor[i + 1].key;
      } else {
        keyNext = max;
      }
      const color = interpolateColor[i].value;
      const current = (key - min) / (max - min) * w;
      const next = (keyNext - min) / (max - min) * w;
      ctx.fillStyle = color;
      ctx.fillRect(current, 0, next - current, 1);
    }
  }
  function createLinearGradient(range, styleAttrField) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { input: interpolateColor, interpolation } = parseColorStyle(styleAttrField);
    if (ctx && interpolateColor && Array.isArray(interpolateColor)) {
      const keys = interpolateColor.map((d) => parseFloat(d.key));
      const colorRange = [Math.min(...keys), Math.max(...keys)];
      const [min, max] = [range[0] || colorRange[0], range[1] || colorRange[1]];
      const w = 256;
      const h = 1;
      canvas.width = w;
      canvas.height = h;
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      if (interpolation?.name === "linear") {
        createGradient(interpolateColor, min, max, w, h, gradient, ctx);
      } else if (interpolation?.name === "step") {
        if (interpolation?.base === true || index.isNumber(interpolation?.base)) {
          const interval = Number(interpolation?.base);
          createGradient(interpolateColor, min, max, w, h, gradient, ctx);
          const len = Math.round((max - min) / interval);
          const canvas2 = document.createElement("canvas");
          const ctx2 = canvas2.getContext("2d", {
            willReadFrequently: true
          });
          canvas2.width = w;
          canvas2.height = h;
          for (let j = 0; j < len; j++) {
            let keyNext = j;
            if (j < len - 1) {
              keyNext = j + 1;
            } else {
              keyNext = len;
            }
            const current = Math.round(j / len * w);
            const color = ctx.getImageData(current, 0, 1, 1).data;
            const next = Math.round(keyNext / len * w);
            ctx2.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
            ctx2.fillRect(current, 0, next - current, h);
          }
          return {
            data: new Uint8Array(ctx2.getImageData(0, 0, w, h).data),
            colorRange
          };
        } else if (interpolation?.base === false) {
          createStepGradient(interpolateColor, min, max, w, h, ctx);
        }
      } else {
        console.warn(`[wind-core]: invalid action type: ${interpolation}`);
      }
      return {
        data: new Uint8Array(ctx.getImageData(0, 0, w, h).data),
        colorRange
      };
    } else {
      return {};
    }
  }
  function exponentialInterpolation(input, base, lowerValue, upperValue) {
    const difference = upperValue - lowerValue;
    const progress = input - lowerValue;
    if (difference === 0) {
      return 0;
    } else if (base === 1) {
      return progress / difference;
    } else {
      return (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
    }
  }
  function interpolationFactor(interpolation, input, lower, upper) {
    let t = 0;
    if (interpolation.name === "exponential") {
      t = exponentialInterpolation(input, interpolation.base, lower, upper);
    } else if (interpolation.name === "linear") {
      t = exponentialInterpolation(input, 1, lower, upper);
    } else if (interpolation.name === "cubic-bezier") {
      console.warn("interpolationFactor");
    }
    return t;
  }
  function interpolateNumber(a, b, t) {
    return a * (1 - t) + b * t;
  }
  const cachedStyle = {};
  function isRasterize(styleAttrField) {
    if (Array.isArray(styleAttrField) && styleAttrField.length > 3) {
      const type = styleAttrField[0];
      return type === "rasterize";
    } else {
      console.warn("[wind-core]: style-parser style config invalid");
      return false;
    }
  }
  function createZoom(uid, zoom, key, styles, clearCache) {
    const ukey = `${uid}_${key}`;
    const styleAttrField = styles[key];
    if (index.isNumber(styleAttrField)) {
      if (cachedStyle[ukey]) {
        delete cachedStyle[ukey];
      }
      return styleAttrField;
    }
    if (styleAttrField && Array.isArray(styleAttrField) && (!cachedStyle[ukey] || clearCache)) {
      cachedStyle[ukey] = parseZoomStyle(styleAttrField);
    }
    if (cachedStyle[ukey]) {
      const { input: interpolateZoom, interpolation } = cachedStyle[ukey] || {};
      if (interpolateZoom && Array.isArray(interpolateZoom)) {
        const labels = interpolateZoom.map((i) => i.key);
        const outputs = interpolateZoom.map((i) => i.value);
        if (zoom <= labels[0]) {
          return outputs[0];
        }
        const stopCount = labels.length;
        if (zoom >= labels[stopCount - 1]) {
          return outputs[stopCount - 1];
        }
        const index = findStopLessThanOrEqualTo(labels, zoom);
        const idx = labels.length - 1;
        const lower = labels[index];
        const upper = labels[index >= idx ? idx : index + 1];
        const t = interpolationFactor(interpolation, zoom, lower, upper);
        const outputLower = outputs[index];
        const outputUpper = outputs[index >= idx ? idx : index + 1];
        return interpolateNumber(outputLower, outputUpper, t);
      } else {
        return 1;
      }
    }
    return 1;
  }
  var RenderType = /* @__PURE__ */ ((RenderType2) => {
    RenderType2[RenderType2["image"] = 0] = "image";
    RenderType2[RenderType2["colorize"] = 1] = "colorize";
    RenderType2[RenderType2["particles"] = 2] = "particles";
    RenderType2[RenderType2["arrow"] = 3] = "arrow";
    RenderType2[RenderType2["barb"] = 4] = "barb";
    RenderType2[RenderType2["wave"] = 5] = "wave";
    return RenderType2;
  })(RenderType || {});
  var RenderFrom = /* @__PURE__ */ ((RenderFrom2) => {
    RenderFrom2["r"] = "r";
    RenderFrom2["rg"] = "rg";
    RenderFrom2["rgba"] = "rgba";
    RenderFrom2["float"] = "float";
    return RenderFrom2;
  })(RenderFrom || {});
  function getBandType(renderFrom) {
    if (renderFrom === "rg") {
      return 1;
    }
    if (renderFrom === "rgba") {
      return 2;
    }
    if (renderFrom === "float") {
      return 3;
    }
    return 0;
  }
  var DecodeType = /* @__PURE__ */ ((DecodeType2) => {
    DecodeType2[DecodeType2["image"] = 0] = "image";
    DecodeType2[DecodeType2["unit8"] = 1] = "unit8";
    DecodeType2[DecodeType2["tiff"] = 2] = "tiff";
    DecodeType2[DecodeType2["imageWithExif"] = 3] = "imageWithExif";
    return DecodeType2;
  })(DecodeType || {});
  var LayerSourceType = /* @__PURE__ */ ((LayerSourceType2) => {
    LayerSourceType2["image"] = "image";
    LayerSourceType2["tile"] = "tile";
    LayerSourceType2["timeline"] = "timeline";
    return LayerSourceType2;
  })(LayerSourceType || {});
  var TileState = /* @__PURE__ */ ((TileState2) => {
    TileState2["loading"] = "0";
    TileState2["loaded"] = "1";
    TileState2["errored"] = "2";
    TileState2["unloaded"] = "3";
    TileState2["reloading"] = "4";
    return TileState2;
  })(TileState || {});
  var MaskType = /* @__PURE__ */ ((MaskType2) => {
    MaskType2[MaskType2["outside"] = 0] = "outside";
    MaskType2[MaskType2["inside"] = 1] = "inside";
    return MaskType2;
  })(MaskType || {});
  var maskVert = "#define GLSLIFY 1\nattribute vec3 position;uniform vec3 cameraPosition;uniform mat4 viewMatrix;uniform mat4 modelMatrix;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;uniform float u_offset;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position+vec3(u_offset,0.0,0.0),1.0);}";
  var maskFrag = "#defines\nprecision mediump float;\n#define GLSLIFY 1\nvoid main(){gl_FragColor=vec4(0.0,0.0,0.0,0.0);}";
  class MaskPass extends Pass {
    constructor(id, renderer, options = {}) {
      super(id, renderer, options);
      this.prerender = true;
      this.#program = new Program(renderer, {
        vertexShader: maskVert,
        fragmentShader: maskFrag,
        includes: shaderLib,
        transparent: true
      });
      this.#meshes = [];
      this.updateGeometry();
    }
    #program;
    #meshes;
    updateGeometry() {
      const { mask } = this.options;
      if (!mask || mask.data.length === 0)
        return;
      const len = mask.data.length;
      let i = 0;
      for (let k = 0; k < this.#meshes.length; k++) {
        const mesh = this.#meshes[k];
        if (mesh.geometry) {
          mesh.geometry.destroy();
        }
      }
      this.#meshes = [];
      for (; i < len; i++) {
        const attributes = mask.data[i];
        this.#meshes.push(
          new Mesh(this.renderer, {
            mode: this.renderer.gl.TRIANGLES,
            program: this.#program,
            geometry: new Geometry(this.renderer, attributes)
          })
        );
      }
    }
    /**
     * @param rendererParams
     * @param rendererState
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    render(rendererParams, rendererState) {
      const attr = this.renderer.attributes;
      this.renderer.setViewport(this.renderer.width * attr.dpr, this.renderer.height * attr.dpr);
      const { worlds = [0] } = rendererParams.cameras;
      const stencil = this.renderer.gl.getParameter(this.renderer.gl.STENCIL_TEST);
      if (!stencil) {
        this.renderer.state.enable(this.renderer.gl.STENCIL_TEST);
      }
      this.renderer.gl.stencilFunc(this.renderer.gl.ALWAYS, 1, 255);
      this.renderer.gl.stencilOp(this.renderer.gl.REPLACE, this.renderer.gl.REPLACE, this.renderer.gl.REPLACE);
      this.renderer.gl.stencilMask(255);
      this.renderer.gl.clearStencil(0);
      this.renderer.gl.clear(this.renderer.gl.STENCIL_BUFFER_BIT);
      for (let k = 0; k < this.#meshes.length; k++) {
        const mesh = this.#meshes[k];
        for (let j = 0; j < worlds.length; j++) {
          mesh.program.setUniform("u_offset", worlds[j]);
          mesh.updateMatrix();
          mesh.worldMatrixNeedsUpdate = false;
          mesh.worldMatrix.multiply(rendererParams.scene.worldMatrix, mesh.localMatrix);
          mesh.draw({
            ...rendererParams,
            camera: rendererParams.cameras.camera
          });
        }
      }
      const ref = this.options.mask?.type === MaskType.outside ? 0 : 1;
      this.renderer.gl.stencilFunc(this.renderer.gl.EQUAL, ref, 255);
      this.renderer.gl.stencilOp(this.renderer.gl.KEEP, this.renderer.gl.KEEP, this.renderer.gl.KEEP);
      return stencil;
    }
  }
  class ArrowComposePass extends ParticlesComposePass {
  }
  var vert = "#define GLSLIFY 1\n#defines\nattribute vec2 uv;attribute vec2 position;attribute vec2 coords;uniform vec2 arrowSize;uniform float u_head;uniform vec2 resolution;uniform float u_devicePixelRatio;uniform vec2 pixelsToProjUnit;uniform vec3 cameraPosition;uniform mat4 viewMatrix;uniform mat4 modelMatrix;uniform mat4 projectionMatrix;uniform vec2 u_extrude_scale;uniform lowp float u_device_pixel_ratio;uniform highp float u_camera_to_center_distance;uniform sampler2D u_texture;uniform sampler2D u_textureNext;uniform sampler2D colorRampTexture;uniform float u_fade_t;uniform vec2 u_image_res;uniform vec2 colorRange;uniform bool useDisplayRange;uniform bool u_flip_y;uniform float u_zoomScale;uniform vec2 displayRange;uniform vec4 u_bbox;uniform vec4 u_data_bbox;uniform vec4 u_tile_bbox;varying vec2 vUv;varying float v_speed;varying float v_speed_t;varying float v_head;varying float v_body;varying float v_antialias;varying float v_linewidth;vec4 calcTexture(const vec2 puv){vec4 color0=texture2D(u_texture,puv);vec4 color1=texture2D(u_textureNext,puv);return mix(color0,color1,u_fade_t);}vec2 decodeValue(const vec2 vc){vec4 rgba=calcTexture(vc);return rgba.rg;}vec2 bilinear(const vec2 uv){vec2 px=1.0/u_image_res;vec2 vc=(floor(uv*u_image_res))*px;vec2 f=fract(uv*u_image_res);vec2 tl=decodeValue(vc);vec2 tr=decodeValue(vc+vec2(px.x,0.0));vec2 bl=decodeValue(vc+vec2(0.0,px.y));vec2 br=decodeValue(vc+px);return mix(mix(tl,tr,f.x),mix(bl,br,f.x),f.y);}float getValue(vec2 rg){return length(rg);}float getAngle(vec2 rg){float angle=atan(rg.y,rg.x);return angle;}void rotate2d(inout vec2 v,float a){mat2 m=mat2(cos(a),-sin(a),sin(a),cos(a));v=m*v;}void main(){vUv=uv;vec2 pos=u_tile_bbox.xy+coords.xy*(u_tile_bbox.zw-u_tile_bbox.xy);vec2 size=arrowSize*u_zoomScale*pixelsToProjUnit*u_devicePixelRatio;vec2 halfSize=size/2.0;vec2 worldPosition=vec2(-halfSize.x,-halfSize.y);if(position.x==1.0){worldPosition.x=halfSize.x;}if(position.y==1.0){worldPosition.y=halfSize.y;}worldPosition+=halfSize*vec2(1.0,0);vec2 textureCoord=(pos.xy-u_data_bbox.xy)/(u_data_bbox.zw-u_data_bbox.xy);if(u_flip_y){textureCoord=vec2(textureCoord.x,1.0-textureCoord.y);}vec2 rg=bilinear(textureCoord);float value=getValue(rg);float angle=getAngle(rg);angle=u_flip_y ? angle*-1. : angle;rotate2d(worldPosition,angle);worldPosition+=pos;v_speed=value;v_speed_t=(value-colorRange.x)/(colorRange.y-colorRange.x);v_linewidth=mix(0.18,0.12,v_speed_t);v_head=u_head;v_antialias=1.0/min(arrowSize.x,arrowSize.y);v_body=mix(0.15,4.0,v_speed_t)*3.0;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(worldPosition,0.0,1.0);}";
  var frag = "#defines\nprecision highp float;\n#define GLSLIFY 1\nuniform sampler2D u_texture;uniform sampler2D u_textureNext;uniform sampler2D colorRampTexture;uniform float u_fade_t;uniform vec2 u_image_res;uniform vec2 colorRange;uniform bool useDisplayRange;uniform vec2 displayRange;uniform float opacity;varying vec2 vUv;varying float v_speed;varying float v_speed_t;varying float v_head;varying float v_body;varying float v_antialias;varying float v_linewidth;vec4 calcTexture(const vec2 puv){vec4 color0=texture2D(u_texture,puv);vec4 color1=texture2D(u_textureNext,puv);return mix(color0,color1,u_fade_t);}float disc(vec2 pos,float size){return length(pos)-size/2.0;}vec4 filled(float distance,float linewidth,float antialias,vec4 fill){vec4 frag_color=vec4(0.0);float t=linewidth/2.0-antialias;float signed_distance=distance;float border_distance=abs(signed_distance)-t;float alpha=border_distance/antialias;alpha=exp(-alpha*alpha);if(border_distance<0.0){frag_color=fill;}else if(signed_distance<0.0){frag_color=fill;}return frag_color;}float line_distance(vec2 p,vec2 p1,vec2 p2){vec2 center=(p1+p2)*0.5;float len=length(p2-p1);vec2 dir=(p2-p1)/len;vec2 rel_p=p-center;return dot(rel_p,vec2(dir.y,-dir.x));}float segment_distance(vec2 p,vec2 p1,vec2 p2){vec2 center=(p1+p2)*0.5;float len=length(p2-p1);vec2 dir=(p2-p1)/len;vec2 rel_p=p-center;float dist1=abs(dot(rel_p,vec2(dir.y,-dir.x)));float dist2=abs(dot(rel_p,dir))-0.5*len;return max(dist1,dist2);}float arrow_stealth(vec2 texcoord,float body,float head,float linewidth,float antialias){float w=linewidth/2.0+antialias;vec2 start=-vec2(body/2.0,0.0);vec2 end=+vec2(body/2.0,0.0);float height=0.5;float d1=line_distance(texcoord,end-head*vec2(+1.0,-height),end);float d2=line_distance(texcoord,end-head*vec2(+1.0,-height),end-vec2(3.0*head/4.0,0.0));float d3=line_distance(texcoord,end-head*vec2(+1.0,+height),end);float d4=line_distance(texcoord,end-head*vec2(+1.0,+0.5),end-vec2(3.0*head/4.0,0.0));float d5=segment_distance(texcoord,start,end-vec2(linewidth,0.0));return min(d5,max(max(-d1,d3),-max(-d2,d4)));}void main(){vec2 uv=vUv;if(calcTexture(uv).a==0.0||v_speed<0.0){discard;}vec2 pos=vUv-vec2(0.0,0.5);vec2 ramp_pos=vec2(v_speed_t,0.5);vec4 color=texture2D(colorRampTexture,ramp_pos);bool display=true;if(useDisplayRange){display=v_speed<=displayRange.y&&v_speed>=displayRange.x;}if(display){if(v_speed>0.2){float d=arrow_stealth(pos.xy,v_body,v_head,v_linewidth,v_antialias);vec4 rc=filled(d,0.15,0.01,color);gl_FragColor=vec4(floor(255.0*rc*opacity)/255.0);}else{float d=disc(pos,0.15);vec4 rc=filled(d,0.01,0.01,color);gl_FragColor=vec4(floor(255.0*rc*opacity)/255.0);}}else{gl_FragColor=vec4(0.0,0.0,0.0,0.0);}}";
  const TILE_EXTENT = 4096;
  class ArrowPass extends Pass {
    constructor(id, renderer, options = {}) {
      super(id, renderer, options);
      this.prerender = false;
      this.#program = new Program(renderer, {
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          opacity: {
            value: 1
          },
          u_fade_t: {
            value: 0
          },
          displayRange: {
            value: new Vector2(-Infinity, Infinity)
          },
          u_texture: {
            value: this.options.texture
          },
          u_textureNext: {
            value: this.options.textureNext
          },
          colorRampTexture: {
            value: null
          }
        },
        defines: [`RENDER_TYPE ${this.options.bandType}`, `LITTLE_ENDIAN ${littleEndian}`],
        includes: shaderLib,
        transparent: true
      });
      this.#mesh = new Mesh(this.renderer, {
        mode: this.renderer.gl.TRIANGLES,
        program: this.#program,
        geometry: new Geometry(this.renderer, {
          index: {
            size: 1,
            // data: new Uint16Array([0, 1, 2, 2, 1, 3]),
            data: new Uint16Array([0, 1, 2, 0, 2, 3])
          },
          position: {
            size: 2,
            // data: new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]),
            data: new Float32Array([0, 1, 0, 0, 1, 0, 1, 1])
          },
          uv: {
            size: 2,
            data: new Float32Array([0, 1, 0, 0, 1, 0, 1, 1])
          },
          coords: {
            divisor: 1,
            data: new Float32Array(2),
            offset: 0,
            size: 2,
            stride: 8
          }
        })
      });
    }
    #mesh;
    #program;
    #geometry;
    #vertexArray;
    #lastTileSize;
    #lastSpace;
    createTileVertexArray(tileSize, space = 20) {
      if (!this.#vertexArray || tileSize !== this.#lastTileSize || space !== this.#lastSpace) {
        this.#lastTileSize = tileSize;
        this.#lastSpace = space;
        const column = Math.round(tileSize / space);
        const columnUnit = 1 / column;
        const halfUnit = columnUnit / 2;
        const points = [];
        for (let j = 0; j < column; j++) {
          for (let i = 0; i < column; i++) {
            points.push({
              x: TILE_EXTENT * (halfUnit + i * columnUnit),
              y: TILE_EXTENT * (halfUnit + j * columnUnit)
            });
          }
        }
        this.#vertexArray = new Float32Array(points.length * 2);
        for (let i = 0; i < points.length; i++) {
          const point = points[i];
          const pos = {
            x: Math.round(point.x),
            y: Math.round(point.y)
          };
          if (pos.x < 0 || pos.x >= TILE_EXTENT || pos.y < 0 || pos.y >= TILE_EXTENT)
            continue;
          this.#vertexArray[2 * i] = pos.x / TILE_EXTENT;
          this.#vertexArray[2 * i + 1] = pos.y / TILE_EXTENT;
        }
        const geometry = new Geometry(this.renderer, {
          index: {
            size: 1,
            data: new Uint16Array([0, 1, 2, 0, 2, 3])
          },
          position: {
            size: 2,
            data: new Float32Array([0, 1, 0, 0, 1, 0, 1, 1])
          },
          uv: {
            size: 2,
            data: new Float32Array([0, 1, 0, 0, 1, 0, 1, 1])
          },
          coords: {
            divisor: 1,
            data: this.#vertexArray,
            offset: 0,
            size: 2,
            stride: 8
          }
        });
        if (this.#mesh) {
          this.#mesh.updateGeometry(geometry, true);
        }
      }
      return this.#vertexArray;
    }
    /**
     * @param rendererParams
     * @param rendererState
     */
    render(rendererParams, rendererState) {
      const attr = this.renderer.attributes;
      this.renderer.setViewport(this.renderer.width * attr.dpr, this.renderer.height * attr.dpr);
      const camera = rendererParams.cameras.camera;
      const tileSize = this.options.source.tileSize ?? 256;
      const tiles = this.options.getGridTiles(this.options.source);
      let stencil;
      if (this.maskPass) {
        stencil = this.maskPass.render(rendererParams, rendererState);
      }
      if (rendererState && this.#mesh && tiles && tiles.length > 0) {
        const uniforms = index.pick(rendererState, [
          "opacity",
          "colorRange",
          "dataRange",
          "colorRampTexture",
          "useDisplayRange",
          "displayRange"
        ]);
        const zoom = rendererState.zoom;
        const dataBounds = rendererState.sharedState.u_data_bbox;
        this.createTileVertexArray(tileSize, rendererState.symbolSpace);
        for (let i = 0; i < tiles.length; i++) {
          const tile = tiles[i];
          const bounds = tile.getTileProjBounds();
          const scaleFactor = Math.pow(2, zoom - tile.overscaledZ);
          const max = Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top);
          const scale = 1 / max;
          const pixelToUnits = 1 / (tileSize * scaleFactor) / scale;
          Object.keys(uniforms).forEach((key) => {
            if (uniforms[key] !== void 0) {
              this.#mesh?.program.setUniform(key, uniforms[key]);
            }
          });
          const fade = this.options.source?.getFadeTime?.() || 0;
          this.#mesh.program.setUniform(
            "u_image_res",
            new Vector2(this.options.texture.width, this.options.texture.height)
          );
          this.#mesh.program.setUniform("u_fade_t", fade);
          this.#mesh.program.setUniform("arrowSize", rendererState.symbolSize);
          this.#mesh.program.setUniform("pixelsToProjUnit", new Vector2(pixelToUnits, pixelToUnits));
          this.#mesh.program.setUniform("u_bbox", rendererState.extent);
          this.#mesh.program.setUniform("u_data_bbox", dataBounds);
          this.#mesh.program.setUniform(
            "u_tile_bbox",
            rendererState.u_flip_y ? [bounds.left, bounds.bottom, bounds.right, bounds.top] : [bounds.left, bounds.top, bounds.right, bounds.bottom]
          );
          this.#mesh.program.setUniform("u_head", 0.1);
          this.#mesh.program.setUniform("u_devicePixelRatio", attr.dpr);
          this.#mesh.program.setUniform("u_texture", this.options.texture);
          this.#mesh.program.setUniform("u_textureNext", this.options.textureNext);
          this.#mesh.program.setUniform("u_flip_y", rendererState.u_flip_y);
          this.#mesh.program.setUniform("u_zoomScale", rendererState.u_zoomScale);
          this.#mesh.updateMatrix();
          this.#mesh.worldMatrixNeedsUpdate = false;
          this.#mesh.worldMatrix.multiply(rendererParams.scene.worldMatrix, this.#mesh.localMatrix);
          this.#mesh.draw({
            ...rendererParams,
            camera
          });
        }
      }
      if (!stencil) {
        this.renderer.state.disable(this.renderer.gl.STENCIL_TEST);
      }
    }
    destroy() {
      if (this.#mesh) {
        this.#mesh.destroy();
        this.#mesh = null;
      }
      if (this.#program) {
        this.#program.destroy();
        this.#program = null;
      }
      if (this.#geometry) {
        this.#geometry.destroy();
        this.#geometry = null;
      }
    }
  }
  const defaultOptions = {
    getViewTiles: () => [],
    getGridTiles: () => [],
    getTileProjSize: (z) => [256, 256],
    // eslint-disable-line
    getPixelsToUnits: () => [1, 1],
    getPixelsToProjUnit: () => [1, 1],
    renderType: RenderType.colorize,
    renderFrom: RenderFrom.r,
    styleSpec: {
      "fill-color": [
        "interpolate",
        ["linear"],
        ["get", "value"],
        0,
        "#3288bd",
        10,
        "#66c2a5",
        20,
        "#abdda4",
        30,
        "#e6f598",
        40,
        "#fee08b",
        50,
        "#fdae61",
        60,
        "#f46d43",
        100,
        "#d53e4f"
      ],
      opacity: 1,
      numParticles: 65535,
      speedFactor: 1,
      fadeOpacity: 0.93,
      dropRate: 3e-3,
      dropRateBump: 2e-3,
      space: 20,
      size: [16, 16]
    },
    displayRange: [Infinity, Infinity],
    widthSegments: 1,
    heightSegments: 1,
    wireframe: false,
    flipY: false,
    glScale: () => 1,
    zoomScale: () => 1,
    onInit: () => void 0
  };
  let registerDeps = false;
  let BaseLayer$1 = class BaseLayer {
    #opacity;
    #numParticles;
    #speedFactor;
    #fadeOpacity;
    #dropRate;
    #dropRateBump;
    #space;
    #size;
    #colorRange;
    #colorRampTexture;
    #nextStencilID;
    #maskPass;
    #isRasterize;
    constructor(source, rs, options) {
      this.renderer = rs.renderer;
      this.scene = rs.scene;
      this.source = source;
      if (!this.renderer) {
        throw new Error("initialize error");
      }
      this.uid = index.uid("ScalarFill");
      if (!options) {
        options = {};
      }
      this.options = {
        ...defaultOptions,
        ...options,
        styleSpec: {
          ...defaultOptions.styleSpec,
          ...options.styleSpec
        }
      };
      this.#opacity = 1;
      this.#nextStencilID = 1;
      this.dispatcher = new wgw$1.Dispatcher(wgw$1.getGlobalWorkerPool(), this, this.uid);
      if (!registerDeps) {
        const deps = wgw$1.getConfigDeps();
        this.dispatcher.broadcast(
          "configDeps",
          deps.map((d) => resolveURL(d)),
          (err, data) => {
            this.options.onInit?.(err, data);
          }
        );
        registerDeps = true;
      }
      this.update = this.update.bind(this);
      this.onTileLoaded = this.onTileLoaded.bind(this);
      this.source.prepare(this.renderer, this.dispatcher, {
        renderFrom: this.options.renderFrom ?? RenderFrom.r
      });
      this.source.onAdd(this);
      if (Array.isArray(this.source.sourceCache)) {
        this.source.sourceCache.forEach((s) => {
          s.on("update", this.update);
          s.on("tileLoaded", this.onTileLoaded);
        });
      } else {
        this.source.sourceCache.on("update", this.update);
        this.source.sourceCache.on("tileLoaded", this.onTileLoaded);
      }
      this.initialize();
    }
    initialize() {
      this.updateOptions({});
      this.sharedState = {
        u_bbox: [0, 0, 1, 1],
        u_data_bbox: [0, 0, 1, 1],
        u_scale: [1, 1]
      };
      this.renderPipeline = new Pipelines(this.renderer);
      const bandType = getBandType(this.options.renderFrom ?? RenderFrom.r);
      if (this.options.mask) {
        this.#maskPass = new MaskPass("MaskPass", this.renderer, {
          mask: this.options.mask
        });
      }
      if (this.options.renderType === RenderType.image) {
        const composePass = new ComposePass2("RasterComposePass", this.renderer, {
          bandType,
          source: this.source,
          renderFrom: this.options.renderFrom ?? RenderFrom.r,
          maskPass: this.#maskPass,
          stencilConfigForOverlap: this.stencilConfigForOverlap.bind(this)
        });
        const rasterPass = new RasterPass("RasterPass", this.renderer, {
          bandType,
          source: this.source,
          texture: composePass.textures.current,
          textureNext: composePass.textures.next
        });
        this.renderPipeline?.addPass(composePass);
        if (this.options.picking) {
          const pickerPass = new PickerPass("PickerPass", this.renderer, {
            source: this.source,
            texture: composePass.textures.current,
            textureNext: composePass.textures.next,
            useFloatTexture: false
          });
          this.renderPipeline?.addPass(pickerPass);
        }
        this.renderPipeline?.addPass(rasterPass);
      } else if (this.options.renderType === RenderType.colorize) {
        const composePass = new ComposePass$1("ColorizeComposePass", this.renderer, {
          bandType,
          source: this.source,
          renderFrom: this.options.renderFrom ?? RenderFrom.r,
          maskPass: this.#maskPass,
          stencilConfigForOverlap: this.stencilConfigForOverlap.bind(this),
          isRasterize: () => this.#isRasterize
        });
        const colorizePass = new ColorizePass("ColorizePass", this.renderer, {
          bandType,
          source: this.source,
          texture: composePass.textures.current,
          textureNext: composePass.textures.next
        });
        this.renderPipeline?.addPass(composePass);
        if (this.options.picking) {
          const pickerPass = new PickerPass("PickerPass", this.renderer, {
            source: this.source,
            texture: composePass.textures.current,
            textureNext: composePass.textures.next,
            useFloatTexture: true
          });
          this.renderPipeline?.addPass(pickerPass);
        }
        this.renderPipeline?.addPass(colorizePass);
      } else if (this.options.renderType === RenderType.particles) {
        const composePass = new ParticlesComposePass("ParticlesComposePass", this.renderer, {
          id: index.uid("ParticlesComposePass"),
          bandType,
          source: this.source,
          renderFrom: this.options.renderFrom ?? RenderFrom.r,
          stencilConfigForOverlap: this.stencilConfigForOverlap.bind(this),
          getTileProjSize: this.options.getTileProjSize
        });
        this.renderPipeline?.addPass(composePass);
        const updatePass = new UpdatePass("UpdatePass", this.renderer, {
          bandType,
          source: this.source,
          texture: composePass.textures.current,
          textureNext: composePass.textures.next,
          getParticleNumber: () => this.#numParticles,
          glScale: this.options.glScale?.()
        });
        this.renderPipeline?.addPass(updatePass);
        const particlesPass = new Particles("ParticlesPass", this.renderer, {
          bandType,
          source: this.source,
          texture: composePass.textures.current,
          textureNext: composePass.textures.next,
          getParticles: () => updatePass.textures,
          getParticleNumber: () => this.#numParticles,
          maskPass: this.#maskPass
        });
        const particlesTexturePass = new ScreenPass("ParticlesTexturePass", this.renderer, {
          bandType,
          source: this.source,
          prerender: true,
          enableBlend: false,
          particlesPass
        });
        this.renderPipeline?.addPass(particlesTexturePass);
        this.renderPipeline?.addPass(particlesPass);
        const screenPass = new ScreenPass("ScreenPass", this.renderer, {
          bandType,
          source: this.source,
          prerender: false,
          enableBlend: true,
          particlesPass
        });
        this.renderPipeline?.addPass(screenPass);
        this.raf = new Raf(
          () => {
            if (this.options.triggerRepaint) {
              this.options.triggerRepaint();
            }
          },
          { autoStart: true }
        );
      } else if (this.options.renderType === RenderType.arrow) {
        const composePass = new ArrowComposePass("ArrowComposePass", this.renderer, {
          id: index.uid("ArrowComposePass"),
          bandType,
          source: this.source,
          renderFrom: this.options.renderFrom ?? RenderFrom.r,
          stencilConfigForOverlap: this.stencilConfigForOverlap.bind(this),
          getTileProjSize: this.options.getTileProjSize
        });
        const arrowPass = new ArrowPass("ArrowPass", this.renderer, {
          bandType,
          source: this.source,
          texture: composePass.textures.current,
          textureNext: composePass.textures.next,
          getPixelsToUnits: this.options.getPixelsToUnits,
          getGridTiles: this.options.getGridTiles,
          maskPass: this.#maskPass
        });
        this.renderPipeline?.addPass(composePass);
        this.renderPipeline?.addPass(arrowPass);
      }
    }
    updateOptions(options) {
      this.options = {
        ...this.options,
        ...options,
        styleSpec: {
          ...this.options.styleSpec,
          ...options?.styleSpec
        }
      };
      this.buildColorRamp();
      this.parseStyleSpec(true);
      this.options?.triggerRepaint?.();
    }
    resize(width, height) {
      if (this.renderPipeline) {
        this.renderPipeline.resize(width, height);
      }
    }
    /**
     * 设置填色色阶
     */
    setFillColor() {
      this.buildColorRamp();
    }
    /**
     * 设置图层透明度
     * @param opacity
     */
    setOpacity(opacity) {
      this.#opacity = opacity;
    }
    /**
     * 设置粒子图层的粒子数量
     * @param numParticles
     */
    setNumParticles(numParticles) {
      this.#numParticles = numParticles;
    }
    /**
     * 设置粒子图层的粒子数量
     * @param speedFactor
     */
    setSpeedFactor(speedFactor) {
      this.#speedFactor = speedFactor;
    }
    /**
     * 设置粒子图层的粒子数量
     * @param fadeOpacity
     */
    setFadeOpacity(fadeOpacity) {
      this.#fadeOpacity = fadeOpacity;
    }
    /**
     * 设置粒子图层的粒子数量
     * @param dropRate
     */
    setDropRate(dropRate) {
      this.#dropRate = dropRate;
    }
    /**
     * 设置粒子图层的粒子数量
     * @param dropRateBump
     */
    setDropRateBump(dropRateBump) {
      this.#dropRateBump = dropRateBump;
    }
    /**
     * 设置 symbol 的间距
     * @param space
     */
    setSymbolSpace(space) {
      this.#space = space;
    }
    /**
     * 设置 symbol 的大小
     * @param size
     */
    setSymbolSize(size) {
      this.#size = size;
    }
    /**
     * 解析样式配置
     * @param clear
     */
    parseStyleSpec(clear) {
      if (isFunction(this.options.getZoom)) {
        const zoom = this.options.getZoom();
        this.setOpacity(createZoom(this.uid, zoom, "opacity", this.options.styleSpec, clear));
        if (this.options.renderType === RenderType.particles) {
          this.setNumParticles(createZoom(this.uid, zoom, "numParticles", this.options.styleSpec, clear));
          this.setFadeOpacity(createZoom(this.uid, zoom, "fadeOpacity", this.options.styleSpec, clear));
          this.setSpeedFactor(createZoom(this.uid, zoom, "speedFactor", this.options.styleSpec, clear));
          this.setDropRate(createZoom(this.uid, zoom, "dropRate", this.options.styleSpec, clear));
          this.setDropRateBump(createZoom(this.uid, zoom, "dropRateBump", this.options.styleSpec, clear));
        }
        if (this.options.renderType === RenderType.arrow) {
          this.setSymbolSize(this.options.styleSpec?.size);
          this.setSymbolSpace(createZoom(this.uid, zoom, "space", this.options.styleSpec, clear));
        }
      }
    }
    /**
     * 处理地图缩放事件
     */
    handleZoom() {
      this.parseStyleSpec(false);
    }
    /**
     * 构建渲染所需色带
     */
    buildColorRamp() {
      if (!this.options.styleSpec?.["fill-color"])
        return;
      const { data, colorRange } = createLinearGradient([], this.options.styleSpec?.["fill-color"]);
      this.#isRasterize = isRasterize(this.options.styleSpec?.["fill-color"]);
      if (colorRange) {
        this.#colorRange = new Vector2(...colorRange);
      }
      if (data) {
        this.#colorRampTexture = new DataTexture(this.renderer, {
          data,
          name: "colorRampTexture",
          magFilter: this.renderer.gl.NEAREST,
          minFilter: this.renderer.gl.NEAREST,
          width: 255,
          height: 1
        });
      }
    }
    clearStencil() {
      this.#nextStencilID = 1;
    }
    stencilConfigForOverlap(tiles) {
      const coords = tiles.sort((a, b) => b.overscaledZ - a.overscaledZ);
      const minTileZ = coords[coords.length - 1].overscaledZ;
      const stencilValues = coords[0].overscaledZ - minTileZ + 1;
      if (stencilValues > 1) {
        if (this.#nextStencilID + stencilValues > 256) {
          this.clearStencil();
        }
        const zToStencilMode = {};
        for (let i = 0; i < stencilValues; i++) {
          zToStencilMode[i + minTileZ] = {
            stencil: true,
            mask: 255,
            func: {
              cmp: this.renderer.gl.GEQUAL,
              ref: i + this.#nextStencilID,
              mask: 255
            },
            op: {
              fail: this.renderer.gl.KEEP,
              zfail: this.renderer.gl.KEEP,
              zpass: this.renderer.gl.REPLACE
            }
          };
        }
        this.#nextStencilID += stencilValues;
        return [zToStencilMode, coords];
      }
      return [
        {
          [minTileZ]: {
            // 禁止写入
            stencil: false,
            mask: 0,
            func: {
              cmp: this.renderer.gl.ALWAYS,
              ref: 0,
              mask: 0
            },
            op: {
              fail: this.renderer.gl.KEEP,
              zfail: this.renderer.gl.KEEP,
              zpass: this.renderer.gl.KEEP
            }
          }
        },
        coords
      ];
    }
    moveStart() {
      if (this.renderPipeline && this.options.renderType === RenderType.particles) {
        const particlesPass = this.renderPipeline.getPass("ParticlesPass");
        if (particlesPass) {
          particlesPass.resetParticles();
        }
        this.renderPipeline.passes.forEach((pass) => {
          if (pass.id === "ParticlesTexturePass" || pass.id === "ScreenPass") {
            pass.enabled = false;
          }
          if (pass.id === "ParticlesPass") {
            pass.prerender = false;
          }
        });
      }
    }
    moveEnd() {
      if (this.renderPipeline && this.options.renderType === RenderType.particles) {
        const updatePass = this.renderPipeline.getPass("UpdatePass");
        if (updatePass) {
          updatePass.setInitialize(true);
        }
        this.renderPipeline.passes.forEach((pass) => {
          if (pass.id === "ParticlesTexturePass" || pass.id === "ScreenPass") {
            pass.enabled = true;
          }
          if (pass.id === "ParticlesPass") {
            pass.prerender = true;
          }
        });
      }
    }
    /**
     * 更新视野内的瓦片
     */
    update() {
      const tiles = this.options.getViewTiles(this.source, this.options.renderType);
      if (Array.isArray(this.source.sourceCache)) {
        this.source.sourceCache.forEach((s) => {
          s?.update(tiles);
        });
      } else {
        this.source.sourceCache?.update(tiles);
      }
    }
    onTileLoaded() {
      if (this.options.triggerRepaint && isFunction(this.options.triggerRepaint)) {
        this.options.triggerRepaint();
      }
    }
    setMask(mask) {
      this.options.mask = mask;
      if (this.options.mask) {
        if (!this.#maskPass) {
          this.#maskPass = new MaskPass("MaskPass", this.renderer, {
            mask: this.options.mask
          });
          const raster = this.renderPipeline?.getPass("RasterComposePass");
          if (raster) {
            raster.setMaskPass(this.#maskPass);
          }
          const colorize = this.renderPipeline?.getPass("ColorizeComposePass");
          if (colorize) {
            colorize.setMaskPass(this.#maskPass);
          }
          const particles = this.renderPipeline?.getPass("ParticlesPass");
          if (particles) {
            particles.setMaskPass(this.#maskPass);
          }
          const arrow = this.renderPipeline?.getPass("ArrowPass");
          if (arrow) {
            arrow.setMaskPass(this.#maskPass);
          }
        }
        this.#maskPass.updateGeometry();
        this.options?.triggerRepaint?.();
      }
    }
    async picker(pixel = [0, 0]) {
      if (!this.renderPipeline)
        return null;
      const pickerPass = this.renderPipeline.getPass("PickerPass");
      if (!pickerPass)
        return null;
      return pickerPass.render(void 0, void 0, pixel);
    }
    prerender(cameras, renderTarget) {
      if (this.renderPipeline) {
        this.renderPipeline.prerender(
          {
            scene: this.scene,
            cameras,
            ...renderTarget ? { target: renderTarget } : {}
          },
          {
            zoom: this.options?.getZoom?.() ?? 0,
            extent: this.options?.getExtent?.(),
            opacity: this.#opacity,
            fadeOpacity: this.#fadeOpacity,
            numParticles: this.#numParticles,
            colorRange: this.#colorRange,
            colorRampTexture: this.#colorRampTexture,
            sharedState: this.sharedState,
            u_drop_rate: this.#dropRate,
            u_drop_rate_bump: this.#dropRateBump,
            u_speed_factor: this.#speedFactor,
            u_flip_y: this.options.flipY,
            u_gl_scale: this.options.glScale?.(),
            u_zoomScale: this.options.zoomScale?.(),
            symbolSize: this.#size,
            symbolSpace: this.#space,
            pixelsToProjUnit: this.options.getPixelsToProjUnit()
          }
        );
      }
    }
    render(cameras, renderTarget) {
      if (this.renderPipeline) {
        const state = {
          zoom: this.options?.getZoom?.() ?? 0,
          extent: this.options?.getExtent?.(),
          opacity: this.#opacity,
          fadeOpacity: this.#fadeOpacity,
          numParticles: this.#numParticles,
          colorRange: this.#colorRange,
          colorRampTexture: this.#colorRampTexture,
          displayRange: this.options.displayRange,
          useDisplayRange: Boolean(this.options.displayRange),
          sharedState: this.sharedState,
          u_drop_rate: this.#dropRate,
          u_drop_rate_bump: this.#dropRateBump,
          u_speed_factor: this.#speedFactor,
          u_flip_y: this.options.flipY,
          u_gl_scale: this.options.glScale?.(),
          u_zoomScale: this.options.zoomScale?.(),
          symbolSize: this.#size,
          symbolSpace: this.#space,
          pixelsToProjUnit: this.options.getPixelsToProjUnit()
        };
        this.renderPipeline.render(
          {
            scene: this.scene,
            cameras,
            ...renderTarget ? { target: renderTarget } : {}
          },
          state
        );
      }
    }
    /**
     * 销毁此 Renderer
     */
    destroy() {
      if (this.raf) {
        this.raf.stop();
      }
      if (this.renderPipeline) {
        this.renderPipeline.destroy();
        this.renderPipeline = null;
      }
      if (this.source) {
        if (Array.isArray(this.source.sourceCache)) {
          this.source.sourceCache.forEach((s) => {
            s.off("update", this.update);
            s.off("tileLoaded", this.onTileLoaded);
          });
        } else {
          this.source.sourceCache.off("update", this.update);
          this.source.sourceCache.off("tileLoaded", this.onTileLoaded);
        }
        this.source.destroy();
      }
    }
  };
  class TileID {
    /**
     * @param overscaledZ 扩大的 z 值
     * @param wrap 所处世界
     * @param z 层级
     * @param x 列
     * @param y 行
     * @param options 瓦片其他配置
     */
    constructor(overscaledZ, wrap = 0, z, x, y, options = {}) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.wrap = wrap;
      this.tileKey = `${z}_${x}_${y}-${wrap}`;
      this.unWrappedTileKey = `${z}_${x}_${y}`;
      const max = Math.pow(2, this.z);
      this.wrapedX = max * wrap + this.x;
      this.wrapedY = this.y;
      this.overscaledZ = overscaledZ;
      this.options = options;
      this.getTileBounds();
    }
    /**
     * 获取瓦片范围
     */
    getTileBounds(tileID = this) {
      if (isFunction(this.options.getTileBounds)) {
        this.tileBounds = this.options.getTileBounds(tileID);
      } else {
        console.error("[TileID]: projection function must be provided");
      }
      return this.tileBounds;
    }
    /**
     * 获取瓦片投影后的范围
     */
    getTileProjBounds(tileID = this, force) {
      if (!this.projTileBounds || force) {
        this.projTileBounds = this.options.getTileProjBounds?.(tileID);
      }
      return this.projTileBounds;
    }
    overscaleFactor() {
      return Math.pow(2, this.overscaledZ - this.z);
    }
    /**
     * 缩放到目标层级
     * @param targetZ
     */
    scaledTo(targetZ) {
      const zDifference = this.z - targetZ;
      if (targetZ > this.z) {
        return new TileID(targetZ, this.wrap, this.z, this.x, this.y, this.options);
      } else {
        return new TileID(targetZ, this.wrap, targetZ, this.x >> zDifference, this.y >> zDifference, this.options);
      }
    }
    /**
     * 获取父级瓦片
     */
    parent() {
      if (this.z > 0)
        return new TileID(this.z - 1, this.wrap, this.z - 1, this.x >> 1, this.y >> 1, this.options);
      else
        return new TileID(this.z, this.wrap, this.z, this.x, this.y, this.options);
    }
    /**
     * 查找当前瓦片的子瓦片
     * @param sourceMaxZoom
     */
    children(sourceMaxZoom) {
      if (this.overscaledZ >= sourceMaxZoom) {
        return [new TileID(this.overscaledZ + 1, this.wrap, this.z, this.x, this.y, this.options)];
      }
      const z = this.z + 1;
      const x = this.x * 2;
      const y = this.y * 2;
      return [
        new TileID(z, this.wrap, z, x, y, this.options),
        new TileID(z, this.wrap, z, x + 1, y, this.options),
        new TileID(z, this.wrap, z, x, y + 1, this.options),
        new TileID(z, this.wrap, z, x + 1, y + 1, this.options)
      ];
    }
    /**
     * 查找兄弟瓦片
     */
    siblings() {
      return this.z === 0 ? [] : this.parent().children(this.overscaledZ).filter((t) => !this.isEqual(t));
    }
    /**
     * 查找相临瓦片
     * @param hor 横向偏移
     * @param ver 纵向偏移
     */
    neighbor(hor, ver = 0) {
      if (this.z === 0) {
        return new TileID(this.overscaledZ, this.wrap + hor, this.z, this.x, this.y, this.options);
      }
      const max = Math.pow(2, this.z);
      const w = this.x + hor;
      const dw = Math.floor(w / max);
      const wrap = this.wrap + dw;
      return new TileID(
        this.overscaledZ,
        wrap,
        this.z,
        (this.x + hor - max * dw) % max,
        (this.y + ver + max) % max,
        this.options
      );
    }
    /**
     * 判断瓦片是否相同
     * 一般我们认为只要 xyz 和所处世界 wrap 相同就确认相同（即 tileKey 相同）
     * @param tile
     */
    isEqual(tile) {
      return tile.tileKey === this.tileKey;
    }
    /**
     * 判断是否是根节点
     * @returns {boolean}
     */
    isRoot() {
      return this.z === 0;
    }
  }
  class TileMesh {
    constructor(id, renderer, program, geometry) {
      this.id = id;
      this.program = program;
      this.mesh = new Mesh(renderer, {
        program,
        geometry
      });
      this.planeMesh = new Mesh(renderer, {
        program,
        geometry: new Geometry(renderer, {
          position: {
            size: 2,
            data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
          },
          uv: {
            size: 2,
            data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
          },
          index: {
            size: 1,
            data: new Uint16Array([0, 1, 2, 2, 1, 3])
          }
        })
      });
    }
    setCenter(center) {
      this.mesh.position.set(center[0], center[1], center[2] || 0);
    }
    getMesh() {
      return this.mesh;
    }
    destroy() {
      this.mesh.destroy();
      this.planeMesh.destroy();
    }
  }
  class Tile {
    /**
     * @param tileID
     * @param options
     */
    constructor(tileID, options = {}) {
      this.errorCount = 0;
      this.maxErrorCount = 3;
      this.uses = 0;
      this.tileMeshs = /* @__PURE__ */ new Map();
      this.geometries = /* @__PURE__ */ new Map();
      this.#textures = /* @__PURE__ */ new Map();
      this.tileID = tileID;
      this.tileSize = options.tileSize;
      this.request = /* @__PURE__ */ new Map();
      this.state = TileState.loading;
    }
    #textures;
    /**
     * 瓦片是否已经加载到数据
     */
    hasData() {
      return this.state === TileState.loaded || this.state === TileState.reloading;
    }
    /**
     * 瓦片是否已经请求过
     */
    wasRequested() {
      return this.state === TileState.errored || this.state === TileState.loaded;
    }
    /**
     * 瓦片是否加载完成
     */
    isLoaded() {
      return this.state === TileState.loaded || this.state === TileState.reloading || this.state === TileState.errored;
    }
    getMesh(passId) {
      return this.tileMeshs.get(passId);
    }
    get textures() {
      return this.#textures;
    }
    get tileCenter() {
      return [(this.tileBounds.left + this.tileBounds.right) / 2, (this.tileBounds.top + this.tileBounds.bottom) / 2, 0];
    }
    /**
     * 更新瓦片顶点信息
     * @param passId
     * @param bbox
     * @param renderer
     * @param force
     */
    updateGeometry(passId, bbox, renderer, force) {
      this.tileBounds = bbox;
      if (!this.geometries.get(passId) || force) {
        const position = [
          this.tileBounds.left,
          this.tileBounds.top,
          0,
          this.tileBounds.right,
          this.tileBounds.top,
          0,
          this.tileBounds.left,
          this.tileBounds.bottom,
          0,
          this.tileBounds.right,
          this.tileBounds.bottom,
          0
        ];
        let i = 0;
        const len = position.length;
        for (; i < len; i += 3) {
          position[i] = position[i] - this.tileCenter[0];
          position[i + 1] = position[i + 1] - this.tileCenter[1];
          position[i + 2] = position[i + 2] - this.tileCenter[2];
        }
        this.geometries.set(
          passId,
          new Geometry(renderer, {
            position: {
              size: 3,
              data: new Float32Array(position)
            },
            normal: {
              size: 3,
              data: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])
            },
            uv: {
              size: 2,
              data: new Float32Array([0, 1, 1, 1, 0, 0, 1, 0])
            },
            index: {
              data: new Uint16Array([0, 2, 1, 2, 3, 1])
            }
          })
        );
      }
      return this.geometries.get(passId);
    }
    /**
     * 创建 `TileMesh`
     * @param passId 在多个 render pass 共享 tile 时我们可能需要针对多个 pass 创建渲染资源
     * 在 mapbox 这种共享 gl 上下文的一般我们不需要重建，但是对于 maptalks 这种每个图层一个 gl
     * 上下文的我们需要针对每个 gl上下文绑定资源
     * @param bbox
     * @param renderer
     * @param program
     * @param force
     */
    createMesh(passId, bbox, renderer, program, force) {
      const geometry = this.updateGeometry(passId, bbox, renderer, force);
      if (!this.tileMeshs.get(passId) || force) {
        this.uses++;
        const uid = passId + "_" + this.tileID.tileKey;
        const tileMesh = new TileMesh(uid, renderer, program, geometry);
        tileMesh.setCenter(this.tileCenter);
        this.tileMeshs.set(passId, tileMesh);
      }
      return this.tileMeshs.get(passId);
    }
    /**
     * 创建纹理
     * @param renderer
     * @param index
     * @param image
     * @param parseOptions
     * @param userData
     */
    setTextures(renderer, index, image, parseOptions, userData) {
      const texture = this.#textures.get(index);
      const iib = isImageBitmap(image) || image instanceof Image;
      let dataRange;
      if (userData?.dataRange) {
        dataRange = userData?.dataRange;
      } else if (image.withExif) {
        dataRange = parseRange(image.exif);
      }
      if (texture) {
        if (texture.userData) {
          texture.userData.dataRange = dataRange;
        }
        texture.setData(iib ? image : image.data);
      } else {
        this.#textures.set(
          index,
          new Texture(renderer, {
            userData: dataRange ? {
              dataRange
            } : void 0,
            image: iib ? image : image.data,
            width: image.width,
            height: image.height,
            minFilter: renderer.gl.LINEAR,
            magFilter: renderer.gl.LINEAR,
            wrapS: renderer.gl.CLAMP_TO_EDGE,
            wrapT: renderer.gl.CLAMP_TO_EDGE,
            flipY: false,
            // 注意，对 ImageBitmap 无效
            premultiplyAlpha: false,
            // 禁用 `Alpha` 预乘
            type: parseOptions.renderFrom === RenderFrom.float ? renderer.gl.FLOAT : renderer.gl.UNSIGNED_BYTE,
            format: parseOptions.renderFrom === RenderFrom.float ? renderer.isWebGL2 ? renderer.gl.RED : renderer.gl.LUMINANCE : renderer.gl.RGBA,
            internalFormat: parseOptions.renderFrom === RenderFrom.float ? renderer.isWebGL2 ? renderer.gl.R32F : renderer.gl.LUMINANCE : renderer.gl.RGBA
          })
        );
      }
    }
    /**
     * 获取瓦片世界坐标系下的范围
     */
    getBounds() {
      return this.tileBounds;
    }
    copy(tile) {
      this.#textures = tile.textures;
      this.actor = tile.actor;
      this.state = tile.state !== TileState.errored ? TileState.loaded : TileState.errored;
      this.request = tile.request;
      this.reloadCallback = tile.reloadCallback;
      return this;
    }
    /**
     * 释放瓦片资源
     */
    destroy() {
      for (const [, value] of this.#textures) {
        if (value) {
          value?.destroy();
        }
      }
      this.#textures.clear();
      for (const [, value] of this.geometries) {
        if (value) {
          value?.destroy();
        }
      }
      for (const [, value] of this.tileMeshs) {
        if (value) {
          value?.destroy();
        }
      }
      this.tileMeshs.clear();
    }
  }
  class DoubleQueueNode {
    constructor(key, val) {
      this.key = key;
      this.val = val;
    }
  }
  class LRUCache {
    constructor(max, onRemove) {
      this.max = max;
      this.onRemove = onRemove;
      this.reset();
    }
    /**
     * 当前容量
     */
    get size() {
      return this.map.size;
    }
    reset() {
      if (this.map) {
        const iterator = this.map.entries();
        for (let i = 0; i < this.map.size; i++) {
          const [, value] = iterator.next().value;
          this.onRemove(value.val);
        }
      }
      this.map = /* @__PURE__ */ new Map();
      this.head = new DoubleQueueNode(0, 0);
      this.tail = new DoubleQueueNode(0, 0);
      this.head.next = this.tail;
      return this;
    }
    clear() {
      this.reset();
      this.onRemove = () => void 0;
    }
    has(key) {
      const node = this.map.get(key);
      return node !== void 0;
    }
    get(key) {
      const node = this.map.get(key);
      if (node === void 0) {
        return null;
      }
      this.moveToHead(node);
      return node.val;
    }
    getAndRemove(key) {
      if (!this.has(key)) {
        return null;
      }
      return this.remove(key);
    }
    add(key, value) {
      let oldValue;
      const node = this.map.get(key);
      if (node === void 0) {
        this.eliminate();
        const newNode = new DoubleQueueNode(key, value);
        const temp = this.head.next;
        this.head.next = newNode;
        newNode.next = temp;
        newNode.pre = this.head;
        temp.pre = newNode;
        this.map.set(key, newNode);
        oldValue = null;
      } else {
        this.moveToHead(node);
        oldValue = node.val;
        node.val = value;
      }
      return oldValue;
    }
    remove(key) {
      const deletedNode = this.map.get(key);
      if (deletedNode === void 0) {
        return null;
      }
      deletedNode.pre.next = deletedNode.next;
      deletedNode.next.pre = deletedNode.pre;
      this.onRemove(deletedNode.val);
      this.map.delete(key);
      return deletedNode.val;
    }
    /**
     * 设置最大缓存大小
     * @param max
     */
    setMaxSize(max) {
      this.max = max;
      while (this.size > this.max) {
        this.eliminate();
      }
    }
    // 将节点插入至头部节点
    moveToHead(node) {
      node.pre.next = node.next;
      node.next.pre = node.pre;
      const temp = this.head.next;
      this.head.next = node;
      node.next = temp;
      node.pre = this.head;
      temp.pre = node;
    }
    /**
     * 如果超出缓存限制，那么移除未使用的数据
     * @private
     */
    eliminate() {
      if (this.size < this.max) {
        return;
      }
      const last = this.tail.pre;
      this.onRemove(last.val);
      this.map.delete(last.key);
      last.pre.next = this.tail;
      this.tail.pre = last.pre;
    }
  }
  function compareTileId(a, b) {
    const aWrap = Math.abs(a.wrap * 2) - +(a.wrap < 0);
    const bWrap = Math.abs(b.wrap * 2) - +(b.wrap < 0);
    return a.overscaledZ - b.overscaledZ || bWrap - aWrap || b.y - a.y || b.x - a.x;
  }
  class SourceCache extends EventEmitter {
    #cache;
    static {
      this.maxOverzooming = 10;
    }
    static {
      this.maxUnderzooming = 3;
    }
    constructor(id, source) {
      super();
      this.id = id;
      this.source = source;
      this.cacheTiles = {};
      this.coveredTiles = {};
      this.loadedParentTiles = {};
      this.#cache = new LRUCache(0, this.unloadTile.bind(this));
    }
    /**
     * 判断当前 source 瓦片是否全部加载完毕（成功加载或者加载错误）
     */
    loaded() {
      if (!this.source.loaded()) {
        return false;
      }
      for (const t in this.cacheTiles) {
        const tile = this.cacheTiles[t];
        if (tile.state !== TileState.loaded && tile.state !== TileState.errored)
          return false;
      }
      return true;
    }
    /**
     * 调用 `Source` 的瓦片加载方法
     * 具体由各个`Source` 实现
     * @param tile
     * @param callback
     */
    loadTile(tile, callback) {
      return this.source.loadTile(tile, callback);
    }
    /**
     * 移除已加载的瓦片
     * @param tile
     */
    unloadTile(tile) {
      if (this.source.unloadTile) {
        return this.source.unloadTile(tile, () => void 0);
      }
    }
    /**
     * 取消正在加载中的瓦片
     * @param tile
     */
    abortTile(tile) {
      if (this.source.abortTile) {
        return this.source.abortTile(tile, () => void 0);
      }
    }
    /**
     * 获取所有的可渲染的瓦片 id 并且排序（从 0 世界向两边排序）
     */
    getRenderableIds() {
      const renderables = [];
      for (const id in this.cacheTiles) {
        if (this._isIdRenderable(id))
          renderables.push(this.cacheTiles[id]);
      }
      return renderables.map((tile) => tile.tileID).sort(compareTileId).map((tile) => tile.tileKey);
    }
    _isIdRenderable(id) {
      return this.cacheTiles[id] && this.cacheTiles[id].hasData() && !this.coveredTiles[id];
    }
    /**
     * 获取已经加载的瓦片
     */
    getVisibleCoordinates() {
      return this.getRenderableIds().map((id) => this.cacheTiles[id].tileID);
    }
    /**
     * 瓦片加载完成回调
     * @param tile
     * @param id
     * @param previousState
     * @param err
     * @param disableUpdate
     */
    tileLoaded(tile, id, previousState, err, disableUpdate = false) {
      if (err) {
        tile.state = TileState.errored;
        if (err.status !== 404)
          ;
        else {
          this.emit("update");
        }
        return;
      }
      tile.timeAdded = Date.now();
      if (!disableUpdate) {
        this.emit("update");
      }
      this.emit("tileLoaded");
      if (this.loaded()) {
        this.emit("tilesLoadEnd");
      }
    }
    _addTile(tileID) {
      let tile = this.cacheTiles[tileID.tileKey];
      if (tile)
        return tile;
      tile = this.#cache.getAndRemove(tileID.tileKey);
      if (tile) {
        tile.tileID = tileID;
      }
      const cached = Boolean(tile);
      if (!cached) {
        tile = new Tile(tileID, {
          tileSize: this.source.tileSize * tileID.overscaleFactor()
        });
        this.loadTile(tile, this.tileLoaded.bind(this, tile, tileID.tileKey, tile.state));
      }
      if (!tile)
        return null;
      tile.uses++;
      this.cacheTiles[tileID.tileKey] = tile;
      return tile;
    }
    /**
     * 根据 `tileKey` 移除瓦片
     * @param id
     */
    _removeTile(id) {
      const tile = this.cacheTiles[id];
      if (!tile)
        return;
      tile.uses--;
      delete this.cacheTiles[id];
      if (tile.uses > 0)
        return;
      if (tile.hasData() && tile.state !== TileState.reloading) {
        this.#cache.add(tile.tileID.tileKey, tile);
      } else {
        tile.aborted = true;
        this.abortTile(tile);
        this.unloadTile(tile);
      }
    }
    /**
     * 根据 `TileID` 获取瓦片
     * @param tileID
     */
    getTile(tileID) {
      return this.cacheTiles[tileID?.tileKey];
    }
    /**
     * 该策略会在内存中保留当前层级的瓦片的所有子瓦片（children），直到一直保留到最大覆盖缩放级别（maxCoveringZoom）为止。
     * 简单来说，当当前地图缩放等级超过了当前图层的最大缩放级别时，Mapbox GL JS 会自动加载当前瓦片的所有子瓦片来填充当前视图的空白部分。而 retain any loaded children of ideal tiles up to maxCoveringZoom 这个选项会保留这些子瓦片的缓存，以便在缩放到更高层级时直接使用，而不需要重新加载。
     * 举个例子，假设当前地图缩放等级是 10，最大缩放级别是 14，而 maxCoveringZoom 设置为 12。地图将会加载当前缩放级别为 10 的瓦片，并将其所有子瓦片缓存到内存中，包括缩放级别为 11、12、13 的所有瓦片。但是，因为 maxCoveringZoom 设置为 12，所以缩放到 13 级时，只会使用缓存中缩放级别为 11、12 的子瓦片。当缩放到 14 级时，则不再使用缓存，而是重新加载新的瓦片数据。
     * 需要注意的是，这个选项可能会占用大量内存，因此在使用时需要根据实际情况进行设置。如果需要优化内存使用，可以将 maxCoveringZoom 设置为一个较小的值，以减少缓存的瓦片数量。
     * @param idealTiles
     * @param zoom
     * @param maxCoveringZoom
     * @param retain
     */
    retainLoadedChildren(idealTiles, zoom, maxCoveringZoom, retain) {
      for (const id in this.cacheTiles) {
        let tile = this.cacheTiles[id];
        if (retain[id] || !tile.hasData() || tile.tileID.overscaledZ <= zoom || tile.tileID.overscaledZ > maxCoveringZoom)
          continue;
        let topmostLoadedID = tile.tileID;
        while (tile && tile.tileID.overscaledZ > zoom + 1) {
          const parentID = tile.tileID.scaledTo(tile.tileID.overscaledZ - 1);
          tile = this.cacheTiles[parentID.tileKey];
          if (tile && tile.hasData()) {
            topmostLoadedID = parentID;
          }
        }
        let tileID = topmostLoadedID;
        while (tileID.overscaledZ > zoom) {
          tileID = tileID.scaledTo(tileID.overscaledZ - 1);
          if (idealTiles[tileID.tileKey]) {
            retain[topmostLoadedID.tileKey] = topmostLoadedID;
            break;
          }
        }
      }
    }
    updateLoadedParentTileCache() {
      this.loadedParentTiles = {};
      for (const tileKey in this.cacheTiles) {
        const path = [];
        let parentTile;
        let currentId = this.cacheTiles[tileKey].tileID;
        while (currentId.overscaledZ > 0) {
          if (currentId.tileKey in this.loadedParentTiles) {
            parentTile = this.loadedParentTiles[currentId.tileKey];
            break;
          }
          path.push(currentId.tileKey);
          const parentId = currentId.scaledTo(currentId.overscaledZ - 1);
          parentTile = this.getLoadedTile(parentId);
          if (parentTile) {
            break;
          }
          currentId = parentId;
        }
        for (const key of path) {
          this.loadedParentTiles[key] = parentTile;
        }
      }
    }
    updateRetainedTiles(wrapTiles) {
      const retain = {};
      if (wrapTiles.length === 0) {
        return retain;
      }
      const checked = {};
      const minZoom = wrapTiles.reduce((min, id) => Math.min(min, id.overscaledZ), Infinity);
      const maxZoom = wrapTiles[0].overscaledZ;
      console.assert(minZoom <= maxZoom);
      const minCoveringZoom = Math.max(maxZoom - SourceCache.maxOverzooming, this.source.minZoom);
      const maxCoveringZoom = Math.max(maxZoom + SourceCache.maxUnderzooming, this.source.minZoom);
      const missingTiles = {};
      for (const tileID of wrapTiles) {
        const tile = this._addTile(tileID);
        retain[tileID.tileKey] = tileID;
        if (tile?.hasData())
          continue;
        if (minZoom < this.source.maxZoom) {
          missingTiles[tileID.tileKey] = tileID;
        }
      }
      this.retainLoadedChildren(missingTiles, minZoom, maxCoveringZoom, retain);
      for (const tileID of wrapTiles) {
        let tile = this.cacheTiles[tileID.tileKey];
        if (tile.hasData())
          continue;
        if (tileID.z >= this.source.maxZoom) {
          const childTileLike = tileID.children(this.source.maxZoom)[0];
          const childTile = this.getTile(childTileLike);
          if (!!childTile && childTile.hasData()) {
            retain[childTileLike.tileKey] = childTileLike;
            continue;
          }
        } else {
          const children = tileID.children(this.source.maxZoom);
          if (retain[children[0].tileKey] && retain[children[1].tileKey] && retain[children[2].tileKey] && retain[children[3].tileKey])
            continue;
        }
        let parentWasRequested = tile.wasRequested();
        for (let overscaledZ = tileID.overscaledZ - 1; overscaledZ >= minCoveringZoom; --overscaledZ) {
          const parentId = tileID.scaledTo(overscaledZ);
          if (checked[parentId.tileKey])
            break;
          checked[parentId.tileKey] = true;
          tile = this.getTile(parentId);
          if (!tile && parentWasRequested) {
            tile = this._addTile(parentId);
          }
          if (tile) {
            retain[parentId.tileKey] = parentId;
            parentWasRequested = tile.wasRequested();
            if (tile.hasData())
              break;
          }
        }
      }
      return retain;
    }
    /**
     * 获取已经加载的缓存瓦片
     * @param tileID
     * @return {*}
     */
    getLoadedTile(tileID) {
      const tile = this.cacheTiles[tileID.tileKey];
      if (tile && tile.hasData()) {
        return tile;
      }
      return this.#cache.get(tileID.tileKey);
    }
    /**
     * 查找已经加载的父级瓦片
     * @param tileID
     * @param minCoveringZoom
     */
    findLoadedParent(tileID, minCoveringZoom) {
      if (tileID.tileKey in this.loadedParentTiles) {
        const parent = this.loadedParentTiles[tileID.tileKey];
        if (parent && parent.tileID.overscaledZ >= minCoveringZoom) {
          return parent;
        } else {
          return null;
        }
      }
      for (let z = tileID.overscaledZ - 1; z >= minCoveringZoom; z--) {
        const parentTileID = tileID.scaledTo(z);
        const tile = this.getLoadedTile(parentTileID);
        if (tile) {
          return tile;
        }
      }
    }
    /**
     * 更新当前的缓存大小
     */
    updateCacheSize() {
      const tileSize = this.source.tileSize;
      const { width, height } = this.source.renderer.size;
      const widthInTiles = Math.ceil((width || 4 * tileSize) / tileSize) + 1;
      const heightInTiles = Math.ceil((height || 4 * tileSize) / tileSize) + 1;
      const approxTilesInView = widthInTiles * heightInTiles;
      const commonZoomRange = 5;
      const viewDependentMaxSize = Math.floor(approxTilesInView * commonZoomRange);
      const maxSize = typeof this.source.options.maxTileCacheSize === "number" ? Math.max(this.source.options.maxTileCacheSize, viewDependentMaxSize) : viewDependentMaxSize;
      this.#cache.setMaxSize(maxSize);
    }
    update(wrapTiles) {
      this.coveredTiles = {};
      let tiles = wrapTiles;
      this.updateCacheSize();
      if (this.source.hasTile) {
        tiles = wrapTiles.filter((coord) => this.source.hasTile(coord));
      }
      const retain = this.updateRetainedTiles(tiles);
      if (tiles.length !== 0) {
        const parentsForFading = {};
        const ids = Object.keys(retain);
        for (const id of ids) {
          const tileID = retain[id];
          const tile = this.cacheTiles[id];
          if (!tile)
            continue;
          const parentTile = this.findLoadedParent(
            tileID,
            Math.max(tileID.overscaledZ - SourceCache.maxOverzooming, this.source.minZoom)
          );
          if (parentTile) {
            this._addTile(parentTile.tileID);
            parentsForFading[parentTile.tileID.tileKey] = parentTile.tileID;
          }
        }
        for (const id in parentsForFading) {
          if (!retain[id]) {
            this.coveredTiles[id] = true;
            retain[id] = parentsForFading[id];
          }
        }
      }
      this.emit("tilesLoadStart", {
        retain
      });
      const remove = keysDifference(this.cacheTiles, retain);
      for (const tileKey of remove) {
        this._removeTile(tileKey);
      }
      this.updateLoadedParentTileCache();
      const currentLength = Object.keys(this.cacheTiles).filter((k) => this.cacheTiles[k]?.wasRequested()).length;
      const retainLength = Object.keys(retain).length;
      if (currentLength < retainLength) {
        this.emit("tilesLoading", {
          progress: currentLength / retainLength
        });
      }
    }
    /**
     * 重载当前视野内的瓦片（需要移除缓存）
     */
    reload() {
      this.#cache.reset();
      for (const key in this.cacheTiles) {
        this._reloadTile(key, TileState.reloading);
      }
    }
    _reloadTile(id, state) {
      const tile = this.cacheTiles[id];
      if (!tile)
        return;
      if (tile.state !== TileState.loading) {
        tile.state = state;
      }
      this.loadTile(tile, this.tileLoaded.bind(this, tile, id, state));
    }
    clearTiles() {
      for (const id in this.cacheTiles) {
        this._removeTile(id);
      }
      this.#cache.reset();
    }
    /**
     * 查找覆盖 queryGeometry 的瓦片
     * @param {QueryGeometry} queryGeometry
     * @param {boolean} [visualizeQueryGeometry=false]
     * @param {boolean} use3DQuery
     * @returns
     * @private
     */
    tilesIn(queryGeometry) {
      const tileResults = [];
      for (const tileID in this.cacheTiles) {
        const tile = this.cacheTiles[tileID];
        const tilesToCheck = [0];
        for (const wrap of tilesToCheck) {
          const tileResult = queryGeometry.containsTile(this.source, tile, wrap);
          if (tileResult) {
            tileResults.push(tileResult);
          }
        }
      }
      return tileResults;
    }
    destroy() {
      for (const id in this.cacheTiles) {
        this._removeTile(id);
      }
      this.#cache.reset();
    }
  }
  const URL_PATTERN = /\{ *([\w_]+) *\}/g;
  function formatUrl(url, data) {
    return url.replace(URL_PATTERN, (str, key) => {
      let value = data[key];
      if (value === void 0) {
        throw new Error(`No value provided for variable ${str}`);
      } else if (typeof value === "function") {
        value = value(data);
      }
      return value;
    });
  }
  class TileSource extends EventEmitter {
    constructor(id, options) {
      super();
      this.roundZoom = false;
      this.#loaded = false;
      this.#tileWorkers = /* @__PURE__ */ new Map();
      this.id = id;
      this.type = LayerSourceType.tile;
      this.minZoom = options.minZoom ?? 0;
      this.maxZoom = options.maxZoom ?? 22;
      this.roundZoom = Boolean(options.roundZoom);
      this.scheme = options.scheme || "xyz";
      this.tileSize = options.tileSize || 512;
      this.tileBounds = options.tileBounds;
      this.wrapX = Boolean(options.wrapX);
      const decodeType = options.decodeType || DecodeType.image;
      const maxTileCacheSize = options.maxTileCacheSize;
      this.options = {
        ...options,
        decodeType,
        maxTileCacheSize,
        type: this.type
      };
      this.#sourceCache = new SourceCache(this.id, this);
    }
    #loaded;
    #sourceCache;
    #tileWorkers;
    get sourceCache() {
      return this.#sourceCache;
    }
    onAdd(layer, cb) {
      this.layer = layer;
      this.load(cb);
    }
    update(data, clear = true) {
      this.options.url = data.url;
      this.reload(clear);
      return this;
    }
    prepare(renderer, dispatcher, parseOptions) {
      this.renderer = renderer;
      this.dispatcher = dispatcher;
      this.parseOptions = parseOptions;
    }
    /**
     * 兼容 TileJSON 加载，需要具体实现
     * @param cb
     */
    load(cb) {
      this.#loaded = true;
      this.url = this.options.url;
      if (cb) {
        cb(null);
      }
    }
    loaded() {
      return this.#loaded;
    }
    reload(clear) {
      this.#loaded = false;
      this.load(() => {
        if (clear) {
          this.#sourceCache.clearTiles();
        } else {
          this.#sourceCache.reload();
        }
        this.layer?.update();
      });
    }
    hasTile(coord) {
      return !this.tileBounds || containTile(this.tileBounds, coord.getTileBounds());
    }
    getFadeTime() {
      return 0;
    }
    getUrl(x, y, z) {
      const { subdomains } = this.options;
      let domain = "";
      if (subdomains && Array.isArray(subdomains) && subdomains.length > 0) {
        const { length } = subdomains;
        let s = (x + y) % length;
        if (s < 0) {
          s = 0;
        }
        domain = subdomains[s];
      }
      const data = {
        x,
        y,
        z,
        s: domain
      };
      if (Array.isArray(this.url)) {
        if (this.url.length > 2) {
          console.warn(
            `[TileSource]: Only supports up to two urls, Now there are more than two urls-${this.url.toString()}, and only the first two are selected by default`
          );
        }
        return this.url.filter((item, index) => index < 2).map((u) => formatUrl(u, data));
      }
      return formatUrl(this.url, data);
    }
    asyncActor(tile, url) {
      return new Promise((resolve, reject) => {
        const id = `${tile.tileID.tileKey}-${url}`;
        tile.actor.send(
          "loadData",
          {
            url: resolveURL(url),
            cancelId: id,
            type: "arrayBuffer",
            decodeType: this.options.decodeType
          },
          (e, data) => {
            if (e) {
              return reject(e);
            }
            resolve(data);
          }
        );
        tile.request.set(id, url);
      });
    }
    getTileUrl(tileID) {
      const z = tileID.z;
      const x = tileID.x;
      const y = this.scheme === "tms" ? Math.pow(2, tileID.z) - tileID.y - 1 : tileID.y;
      const url = this.getUrl(x, y, z);
      let urls = url;
      if (index.isString(url)) {
        urls = [url];
      }
      return urls;
    }
    loadTile(tile, callback) {
      try {
        if (!tile.actor || tile.state === TileState.reloading) {
          const urls = this.getTileUrl(tile.tileID);
          const key = urls.join(",");
          this.#tileWorkers.set(key, this.#tileWorkers.get(key) || this.dispatcher.getActor());
          tile.actor = this.#tileWorkers.get(key);
          const p = [];
          for (let i = 0; i < urls.length; i++) {
            p.push(this.asyncActor(tile, urls[i]));
          }
          Promise.all(p).then((data) => {
            tile.request.clear();
            if (tile.aborted) {
              tile.state = TileState.unloaded;
              return callback(null);
            }
            if (!data)
              return callback(null);
            data.forEach((d, index) => {
              tile.setTextures(this.renderer, index, d, this.parseOptions, this.options);
            });
            tile.state = TileState.loaded;
            callback(null);
          }).catch((e) => {
            tile.state = TileState.errored;
            console.log(e);
          });
        } else if (tile.state === TileState.loading) {
          tile.reloadCallback = callback;
        }
      } catch (e) {
        tile.state = TileState.errored;
        return callback(e);
      }
    }
    abortTile(tile, callback) {
      if (tile.request) {
        if (tile.request.size > 0 && tile.actor) {
          const iterator = tile.request.entries();
          for (let i = 0; i < tile.request.size; i++) {
            const [id, url] = iterator.next().value;
            if (id) {
              tile.actor.send(
                "cancel",
                {
                  url,
                  cancelId: id
                },
                (err) => {
                  if (err) {
                    tile.state = TileState.unloaded;
                  }
                }
              );
            }
          }
        }
        tile.request.clear();
      } else {
        tile.state = TileState.unloaded;
      }
      callback();
    }
    unloadTile(tile, callback) {
      if (tile.actor)
        ;
    }
    destroy() {
      this.layer = null;
      this.#loaded = false;
      this.#tileWorkers.clear();
      this.#sourceCache.clear();
    }
  }
  class ImageSource extends EventEmitter {
    constructor(id, options) {
      super();
      this.roundZoom = false;
      this.#loaded = false;
      this.#tileWorkers = /* @__PURE__ */ new Map();
      this.id = id;
      this.type = LayerSourceType.image;
      this.minZoom = 0;
      this.maxZoom = 22;
      this.roundZoom = false;
      this.tileSize = 512;
      this.coordinates = options.coordinates;
      this.wrapX = Boolean(options.wrapX);
      this.url = options.url;
      const decodeType = options.decodeType || DecodeType.image;
      this.options = {
        ...options,
        decodeType,
        type: this.type
      };
      this.#sourceCache = new SourceCache(this.id, this);
    }
    #loaded;
    #sourceCache;
    #tileWorkers;
    get sourceCache() {
      return this.#sourceCache;
    }
    onAdd(layer, cb) {
      this.layer = layer;
      this.load(cb);
    }
    prepare(renderer, dispatcher, parseOptions) {
      this.renderer = renderer;
      this.dispatcher = dispatcher;
      this.parseOptions = parseOptions;
    }
    update(data, clear = true) {
      this.options.url = data.url;
      this.reload(clear);
    }
    updateImage(options, clear = true) {
      this.options = {
        ...this.options,
        ...options
      };
      this.reload(clear);
    }
    setCoordinates(coordinates) {
      this.coordinates = coordinates;
      this.reload(false);
    }
    asyncActor(tile, url) {
      return new Promise((resolve, reject) => {
        const id = `${tile.tileID.tileKey}-${url}`;
        tile.actor.send(
          "loadData",
          {
            url: resolveURL(url),
            cancelId: id,
            type: "arrayBuffer",
            decodeType: this.options.decodeType
          },
          (e, data) => {
            if (e) {
              return reject(e);
            }
            resolve(data);
          }
        );
        tile.request.set(id, url);
      });
    }
    /**
     * 兼容 TileJSON 加载，需要具体实现
     * @param cb
     */
    load(cb) {
      this.#loaded = true;
      this.url = this.options.url;
      if (cb) {
        cb(null);
      }
    }
    loaded() {
      return this.#loaded;
    }
    reload(clear) {
      this.#loaded = false;
      this.load(() => {
        if (clear) {
          this.#sourceCache.clearTiles();
        } else {
          this.#sourceCache.reload();
        }
        this.layer?.update();
      });
    }
    getTileUrl(tileID) {
      let urls = this.url;
      if (index.isString(this.url)) {
        urls = [this.url];
      }
      return urls;
    }
    loadTile(tile, callback) {
      try {
        if (!tile.actor || tile.state === TileState.reloading) {
          const urls = this.getTileUrl(tile.tileID);
          const key = urls.join(",");
          this.#tileWorkers.set(key, this.#tileWorkers.get(key) || this.dispatcher.getActor());
          tile.actor = this.#tileWorkers.get(key);
          const p = [];
          for (let i = 0; i < urls.length; i++) {
            p.push(this.asyncActor(tile, urls[i]));
          }
          Promise.all(p).then((data) => {
            tile.request.clear();
            if (tile.aborted) {
              tile.state = TileState.unloaded;
              return callback(null);
            }
            if (!data)
              return callback(null);
            data.forEach((d, index) => {
              tile.setTextures(this.renderer, index, d, this.parseOptions, this.options);
            });
            tile.state = TileState.loaded;
            callback(null);
          }).catch((e) => {
            tile.state = TileState.errored;
            console.log(e);
          });
        } else if (tile.state === TileState.loading) {
          tile.reloadCallback = callback;
        } else {
        }
      } catch (e) {
        tile.state = TileState.errored;
        return callback(e);
      }
    }
    hasTile(coord) {
      return true;
    }
    getFadeTime() {
      return 0;
    }
    abortTile(tile, callback) {
      if (tile.request) {
        if (tile.request.size > 0 && tile.actor) {
          const iterator = tile.request.entries();
          for (let i = 0; i < tile.request.size; i++) {
            const [id, url] = iterator.next().value;
            if (id) {
              tile.actor.send(
                "cancel",
                {
                  url,
                  cancelId: id
                },
                (err) => {
                  if (err) {
                    tile.state = TileState.unloaded;
                  }
                }
              );
            }
          }
        }
        tile.request.clear();
      } else {
        tile.state = TileState.unloaded;
      }
      callback();
    }
    // eslint-disable-next-line
    unloadTile(tile, cb) {
    }
    destroy() {
      this.layer = null;
      this.#loaded = false;
      this.#tileWorkers.clear();
      this.#sourceCache.clear();
    }
  }
  class TrackManger {
    constructor() {
      this.tracks = /* @__PURE__ */ new Set();
      this.run = this.run.bind(this);
      this.raf = new Raf(this.run);
    }
    add(track) {
      if (!this.tracks.has(track)) {
        this.tracks.add(track);
        this.raf.start();
      }
    }
    run(time) {
      this.tracks.forEach((t) => {
        t.tick(time);
      });
    }
    remove(track) {
      if (this.tracks.has(track)) {
        this.tracks.delete(track);
      }
      if (this.tracks.size === 0) {
        this.raf.stop();
      }
    }
  }
  let tm = null;
  function getTrackManger() {
    if (!tm) {
      tm = new TrackManger();
    }
    return tm;
  }
  const defaultTrackOptions = {
    duration: 1e3,
    autoplay: true,
    repeat: true,
    delay: 0,
    endDelay: 0,
    track: (p) => void 0
    // eslint-disable-line
  };
  const trackManger = getTrackManger();
  class Track extends EventEmitter {
    #playing = false;
    #state = 0;
    #elapsedTime = -1;
    #lastTime = -1;
    #options;
    constructor(options) {
      super();
      this.#options = {
        ...defaultTrackOptions,
        ...options
      };
      if (this.#options.autoplay) {
        this.play();
      }
    }
    /**
     * 获取当前 Track 的状态
     */
    get state() {
      return this.#state;
    }
    /**
     * 获取总的过渡时间
     */
    get totalDuration() {
      return this.#options.delay + this.#options.duration + this.#options.endDelay;
    }
    get elapsedTime() {
      return this.#elapsedTime;
    }
    get totalPosition() {
      return Math.max(0, Math.min(1, this.#elapsedTime / this.totalDuration));
    }
    /**
     * 是否在播放
     */
    get isPlaying() {
      return this.#state === 1;
    }
    /**
     * 是否暂停
     */
    get isPaused() {
      return this.#state === 2;
    }
    /**
     * 是否处于激活状态
     */
    get isActive() {
      return this.isPlaying || this.isPaused;
    }
    /**
     * 获取当前 Track 的 cursor 位置
     */
    get position() {
      if (this.#elapsedTime < this.#options.delay) {
        return 0;
      }
      if (this.#elapsedTime >= this.#options.delay + this.#options.duration) {
        return 1;
      }
      return Math.max(0, Math.min(1, (this.#elapsedTime - this.#options.delay) / this.#options.duration));
    }
    /**
     * 开始播放
     */
    play() {
      this.#playing = true;
      this.#state = 1;
      this.advance(0);
      trackManger.add(this);
    }
    /**
     * 暂停
     */
    pause() {
      if (this.#state === 1) {
        this.#state = 2;
      }
    }
    /**
     * 继续播放
     */
    resume() {
      if (this.#state === 2) {
        this.#state = 1;
      }
    }
    /**
     * 停止
     */
    stop() {
      this.#playing = false;
      this.#state = 3;
      trackManger.remove(this);
    }
    /**
     * 重新开始
     */
    restart() {
      this.#elapsedTime = 0;
      trackManger.add(this);
    }
    /**
     * 重置
     */
    reset() {
      if (this.#state === 1) {
        this.stop();
      } else {
        this.advance(0);
      }
    }
    /**
     * 在播放和暂停状态切换
     */
    toggle() {
      if (this.#playing) {
        if (this.isPlaying) {
          this.pause();
        } else {
          this.resume();
        }
      }
    }
    /**
     * 步进
     * @param position
     * @param e
     */
    advance(position, e = true) {
      const p = index.clamp(position, 0, 1);
      this.#elapsedTime = e ? this.totalDuration * p : this.#options.delay + this.#options.duration * p;
      this.#options?.track?.(this.position);
      this.emit("track", {
        position: this.position
      });
    }
    tick(time) {
      if (this.#lastTime < 0) {
        this.#lastTime = time;
      }
      const lastTime = this.#lastTime;
      this.#lastTime = time;
      if (this.#state !== 1)
        return;
      const delta = time - lastTime;
      this.#elapsedTime += delta;
      this.#elapsedTime = Math.min(this.#elapsedTime, this.totalDuration);
      if (this.totalPosition === 1) {
        this.advance(this.totalPosition);
        this.#options.repeat ? this.restart() : this.stop();
      } else {
        this.advance(this.totalPosition);
      }
    }
  }
  const sourceImpl = {
    tile: TileSource,
    image: ImageSource
  };
  function generateKey(url) {
    let urls = [];
    if (index.isString(url)) {
      urls = [url];
    }
    return urls.join(",");
  }
  class TimelineSource extends EventEmitter {
    constructor(id, options) {
      super();
      this.roundZoom = false;
      this.#loaded = false;
      this.#fadeTime = 0;
      this.#cache = /* @__PURE__ */ new Map();
      this.id = id;
      this.type = LayerSourceType.timeline;
      this.minZoom = options.minZoom ?? 0;
      this.maxZoom = options.maxZoom ?? 22;
      this.roundZoom = Boolean(options.roundZoom);
      const scheme = options.scheme || "xyz";
      this.tileSize = options.tileSize || 512;
      this.tileBounds = options.tileBounds;
      this.wrapX = Boolean(options.wrapX);
      if (options.sourceType === LayerSourceType.image && !options.coordinates) {
        throw new Error("ImageSource must provide `coordinates`");
      }
      this.coordinates = options.coordinates;
      this.intervals = options.intervals;
      const decodeType = options.decodeType || DecodeType.image;
      const maxTileCacheSize = options.maxTileCacheSize;
      this.options = {
        ...defaultTrackOptions,
        ...options,
        decodeType,
        maxTileCacheSize,
        wrapX: this.wrapX,
        type: this.type
      };
      const current = this.intervals[0];
      this.#index = 0;
      this.animate = this.animate.bind(this);
      this.tilesLoadEnd = this.tilesLoadEnd.bind(this);
      const config = {};
      if (options.sourceType === LayerSourceType.image) {
        Object.assign(config, {
          url: current.url,
          coordinates: this.coordinates,
          maxTileCacheSize: this.options.maxTileCacheSize,
          minZoom: this.minZoom,
          maxZoom: this.maxZoom,
          decodeType
        });
      } else if (options.sourceType === LayerSourceType.tile) {
        Object.assign(config, {
          url: current.url,
          subdomains: this.options.subdomains,
          minZoom: this.minZoom,
          maxZoom: this.maxZoom,
          tileSize: this.tileSize,
          roundZoom: this.roundZoom,
          tileBounds: this.tileBounds,
          maxTileCacheSize: this.options.maxTileCacheSize,
          scheme,
          decodeType
        });
      } else {
        throw new Error("\u4E0D\u652F\u6301\u7684\u6570\u636E\u6E90\u7C7B\u578B\uFF01");
      }
      this.#current = new sourceImpl[options.sourceType](`${this.id}_current`, config);
      this.#next = new sourceImpl[options.sourceType](`${this.id}_next`, config);
      const currentLoadTile = this.#current.loadTile;
      const nextLoadTile = this.#next.loadTile;
      const that = this;
      function wrapCurrentLoadTile(tile, callback) {
        const key = `${tile.tileID.tileKey}-${generateKey(this.url)}`;
        const cacheTile = that.#cache.get(key);
        if (cacheTile) {
          tile.copy(cacheTile);
          callback(null, true);
        } else {
          currentLoadTile.call(this, tile, (err, data) => {
            if (!err && !that.#cache.has(key) && tile.state === TileState.loaded) {
              that.#cache.set(key, tile);
            }
            callback(err, data);
          });
        }
      }
      function wrapNextLoadTile(tile, callback) {
        const key = `${tile.tileID.tileKey}-${generateKey(this.url)}`;
        const cacheTile = that.#cache.get(key);
        if (cacheTile) {
          tile.copy(cacheTile);
          callback(null, true);
        } else {
          nextLoadTile.call(this, tile, (err, data) => {
            if (!err && !that.#cache.has(key) && tile.state === TileState.loaded) {
              that.#cache.set(key, tile);
            }
            callback(err, data);
          });
        }
      }
      this.#current.loadTile = wrapCurrentLoadTile;
      this.#next.loadTile = wrapNextLoadTile;
      this.#current.sourceCache.on("tilesLoadEnd", this.tilesLoadEnd);
      this.#next.sourceCache.on("tilesLoadEnd", this.tilesLoadEnd);
    }
    #loaded;
    #sourceCache;
    #current;
    #next;
    #index;
    #fadeTime;
    #track;
    #cache;
    get track() {
      return this.#track;
    }
    get privateType() {
      return this.options.sourceType;
    }
    get cache() {
      return this.#cache;
    }
    get source() {
      return [this.#current, this.#next];
    }
    get sourceCache() {
      return [this.#current?.sourceCache, this.#next?.sourceCache].filter(Boolean);
    }
    onAdd(layer) {
      this.layer = layer;
      if (this.#current) {
        this.#current.onAdd(this.layer, (error) => {
          if (!error) {
            if (this.#next) {
              this.#next.onAdd(this.layer, (err) => {
                if (!err) {
                  this.load();
                }
              });
            }
          }
        });
      }
    }
    prepare(renderer, dispatcher, parseOptions) {
      this.renderer = renderer;
      this.dispatcher = dispatcher;
      this.parseOptions = parseOptions;
      if (this.#current) {
        this.#current.prepare(renderer, dispatcher, parseOptions);
      }
      if (this.#next) {
        this.#next.prepare(renderer, dispatcher, parseOptions);
      }
    }
    getFadeTime() {
      return this.#fadeTime;
    }
    tilesLoadEnd() {
      this.resume();
    }
    animate({ position }) {
      const len = this.intervals.length;
      const lastIndex = this.#index;
      this.#index = position * index.clamp(len - 1, 0, Infinity);
      const diff = Math.floor(this.#index) - Math.floor(lastIndex);
      if (diff > 0 || diff < 0) {
        if (!this.#current?.sourceCache.loaded() || !this.#next?.sourceCache.loaded()) {
          this.pause();
        } else {
          this.#fadeTime = 0;
          [this.#current, this.#next] = [this.#next, this.#current];
          this.pause();
          const item = this.intervals[index.clamp(Math.floor(this.#index), 0, len - 1)];
          this.#next.update(item, true);
        }
      } else {
        this.#fadeTime = this.#index % 1;
      }
      if (this.layer) {
        this.layer.onTileLoaded();
      }
      this.emit("update", {
        position,
        index: this.#index,
        clampIndex: index.clamp(Math.floor(this.#index), 0, len - 1)
      });
    }
    play() {
      this.#track.play();
      this.emit("play", { position: this.#track.position });
    }
    pause() {
      this.#track.pause();
      this.emit("pause", { position: this.#track.position });
    }
    resume() {
      this.#track.resume();
      this.emit("resume", { position: this.#track.position });
    }
    stop() {
      this.#track.stop();
      this.emit("stop", { position: this.#track.position });
    }
    restart() {
      this.#track.restart();
      this.emit("restart", { position: this.#track.position });
    }
    load(cb) {
      this.#loaded = true;
      this.#track = new Track({
        duration: this.options.duration * index.clamp(this.intervals.length - 1, 0, Infinity),
        endDelay: this.options.endDelay,
        repeat: this.options.repeat,
        autoplay: this.options.autoplay
      });
      this.#track.on("track", this.animate);
      this.layer?.update();
      if (cb) {
        cb(null);
      }
      this.emit("loaded", { position: this.#track.position });
    }
    loaded() {
      return this.#loaded;
    }
    destroy() {
      this.layer = null;
      this.#loaded = false;
      this.#track.off("track", this.animate);
      if (this.#sourceCache && Array.isArray(this.#sourceCache)) {
        this.#sourceCache.forEach((s) => {
          s.clear();
        });
      }
      this.emit("destroy");
    }
  }
  const configDeps = wgw$1.configDeps;

  class BaseLayer extends L__namespace.Layer {
    constructor(id, data, options) {
      super(id, data, options);
    }
    initialize(id, data, options) {
      if (!id) {
        throw Error("layer id must be specified");
      }
      this._layerId = id;
      L__namespace.Util.setOptions(this, options);
      this.devicePixelRatio = this.options.devicePixelRatio || // @ts-ignore 忽略错误
      (window.devicePixelRatio || window.screen.deviceXDPI / window.screen.logicalXDPI);
    }
    _createCanvas(id, zIndex) {
      const canvas = createCanvas(this._width, this._height, this.devicePixelRatio);
      canvas.id = String(id);
      // [海纳 patch] 设 canvas CSS 尺寸 = 容器尺寸（否则 DPR≠1 时 canvas 超宽显示，粒子画偏）
      canvas.style.width = this._width + "px";
      canvas.style.height = this._height + "px";
      const panes = this._map.getPanes();
      if (panes && panes.overlayPane) {
        panes.overlayPane.appendChild(canvas);
      }
      return canvas;
    }
    _reset() {
      const topLeft = this._map.containerPointToLayerPoint([0, 0]);
      L__namespace.DomUtil.setPosition(this.canvas, topLeft);
      this._redraw();
    }
    _onResize(resizeEvent) {
      this.canvas.style.width = resizeEvent.newSize.x + "px";
      this.canvas.style.height = resizeEvent.newSize.y + "px";
      this._width = resizeEvent.newSize.x;
      this._height = resizeEvent.newSize.y;
      this._resizeCanvas(this.devicePixelRatio);
    }
    _zoomStart() {
      this._moveStart();
    }
    _moveStart() {
      if (!this._updating) {
        this._updating = true;
      }
      // [海纳 patch] 拖动开始时暂停粒子动画（避免粒子跟着地图动）
      if (this.stop) { this.stop(); }
    }
    _animateZoom(event) {
      const scale = this._map.getZoomScale(event.zoom, this._map.getZoom());
      const offset = this._map._latLngToNewLayerPoint(this._map.getBounds().getNorthWest(), event.zoom, event.center);
      L__namespace.DomUtil.setTransform(this.canvas, offset, scale);
    }
    _resizeCanvas(scale) {
      this.canvas.width = this._width * scale;
      this.canvas.height = this._height * scale;
    }
    _redraw() {
      this._render();
    }
    _render() {
    }
    project(coordinate) {
      const pixel = this._map.latLngToContainerPoint(new L__namespace.LatLng(coordinate[1], coordinate[0]));
      return [pixel.x * this.devicePixelRatio, pixel.y * this.devicePixelRatio];
    }
    unproject(pixel) {
      const coordinates = this._map.containerPointToLatLng(new L__namespace.Point(pixel[0] / this.devicePixelRatio, pixel[1] / this.devicePixelRatio));
      return [coordinates.lng, coordinates.lat];
    }
    intersectsCoordinate(coordinate) {
      const bounds = this._map.getBounds();
      return bounds.contains(L__namespace.latLng(coordinate[1], coordinate[0]));
    }
    onAdd(map) {
      this._map = map;
      const size = map.getSize();
      this._width = size.x;
      this._height = size.y;
      this.canvas = this._createCanvas(this._layerId, this.options.zIndex || 1);
      const animated = this._map.options.zoomAnimation && L__namespace.Browser.any3d;
      L__namespace.DomUtil.addClass(this.canvas, "leaflet-zoom-" + (animated ? "animated" : "hide"));
      this._map.on(this.getEvents(), this);
      this._resetView();
      this._render();
      return this;
    }
    _resetView(e) {
    }
    onMoveEnd() {
      this._reset();
      // [海纳 patch] 移动结束后恢复粒子动画
      if (this.start && this.starting === false) { this.start(); }
    }
    onRemove() {
      const panes = this._map.getPanes();
      if (panes && panes.overlayPane) {
        panes.overlayPane.removeChild(this.canvas);
      }
      this._map.off(this.getEvents(), this);
      this.canvas = null;
      return this;
    }
    getEvents() {
      const events = {
        resize: this._onResize,
        viewreset: this._render,
        moveend: this.onMoveEnd,
        movestart: this._moveStart,
        zoomstart: this._render,
        zoomend: this._render
        // zoomanim: undefined,
      };
      if (this._map.options.zoomAnimation && L__namespace.Browser.any3d) {
        events.zoomanim = this._animateZoom;
      }
      return events;
    }
  }

  class WindLayer extends BaseLayer {
    initialize(id, data, options) {
      super.initialize(id, data, options);
      this.field = void 0;
      this.pickWindOptions();
      if (data) {
        this.setData(data, options.fieldOptions);
      }
    }
    _redraw() {
      this._render();
    }
    _render() {
      const opt = this.getWindOptions();
      if (!this.wind && this._map) {
        const ctx = this.canvas.getContext("2d");
        const data = this.getData();
        this.wind = new WindCore(ctx, opt, data);
        this.wind.project = this.project.bind(this);
        this.wind.unproject = this.unproject.bind(this);
        this.wind.intersectsCoordinate = this.intersectsCoordinate.bind(this);
        this.wind.postrender = () => {
        };
      }
      this.wind.prerender();
      this.wind.render();
    }
    onRemove() {
      if (this.wind) {
        this.wind.stop();
        this.wind = null;
      }
      return super.onRemove();
    }
    pickWindOptions() {
      Object.keys(defaultOptions$2).forEach((key) => {
        if (key in this.options) {
          if (this.options.windOptions === void 0) {
            this.options.windOptions = {};
          }
          this.options.windOptions[key] = this.options[key];
        }
      });
    }
    /**
     * get wind layer data
     */
    getData() {
      return this.field;
    }
    /**
     * set layer data
     * @param data
     * @param options
     * @returns {WindLayer}
     */
    setData(data, options = {}) {
      if (data && data.checkFields && data.checkFields()) {
        this.field = data;
      } else if (isArray(data)) {
        this.field = formatData(data, options);
      } else {
        console.error("Illegal data");
      }
      if (this.field) {
        this?.wind?.updateData(this.field);
      }
      return this;
    }
    setWindOptions(options) {
      const beforeOptions = this.options.windOptions || {};
      this.options = assign(this.options, {
        windOptions: assign(beforeOptions, options || {})
      });
      if (this.wind) {
        const windOptions = this.options.windOptions;
        this.wind.setOptions(windOptions);
        this.wind.prerender();
      }
    }
    getWindOptions() {
      return this.options.windOptions || {};
    }
  }

  var geojsonRewind = rewind;

  function rewind(gj, outer) {
      var type = gj && gj.type, i;

      if (type === 'FeatureCollection') {
          for (i = 0; i < gj.features.length; i++) rewind(gj.features[i], outer);

      } else if (type === 'GeometryCollection') {
          for (i = 0; i < gj.geometries.length; i++) rewind(gj.geometries[i], outer);

      } else if (type === 'Feature') {
          rewind(gj.geometry, outer);

      } else if (type === 'Polygon') {
          rewindRings(gj.coordinates, outer);

      } else if (type === 'MultiPolygon') {
          for (i = 0; i < gj.coordinates.length; i++) rewindRings(gj.coordinates[i], outer);
      }

      return gj;
  }

  function rewindRings(rings, outer) {
      if (rings.length === 0) return;

      rewindRing(rings[0], outer);
      for (var i = 1; i < rings.length; i++) {
          rewindRing(rings[i], !outer);
      }
  }

  function rewindRing(ring, dir) {
      var area = 0, err = 0;
      for (var i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
          var k = (ring[i][0] - ring[j][0]) * (ring[j][1] + ring[i][1]);
          var m = area + k;
          err += Math.abs(area) >= Math.abs(k) ? area - m + k : k - m + area;
          area = m;
      }
      if (area + err >= 0 !== !!dir) ring.reverse();
  }

  var rewind$1 = /*@__PURE__*/getDefaultExportFromCjs(geojsonRewind);

  const { clamp } = index;
  const earthRadius = 63710088e-1;
  const earthCircumference = 2 * Math.PI * earthRadius;
  function circumferenceAtLatitude(latitude) {
    return earthCircumference * Math.cos(latitude * Math.PI / 180);
  }
  function mercatorXfromLng(lng) {
    return (180 + lng) / 360;
  }
  function mercatorYfromLat(lat) {
    return (180 - 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) / 360;
  }
  function mercatorZfromAltitude(altitude, lat) {
    return altitude / circumferenceAtLatitude(lat);
  }
  function lngFromMercatorX(x, wrap = 0) {
    return x * 360 - 180 + wrap * 360;
  }
  function latFromMercatorY(y) {
    const y2 = 180 - y * 360;
    return 360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90;
  }
  const MAX_MERCATOR_LATITUDE = 85.051129;
  function fromLngLat(lngLatLike, altitude = 0) {
    const lat = clamp(lngLatLike.lat, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
    return {
      x: mercatorXfromLng(lngLatLike.lng),
      y: mercatorYfromLat(lat),
      z: mercatorZfromAltitude(altitude, lat)
    };
  }
  function getCoordinatesCenterTileID(coords) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const coord of coords) {
      minX = Math.min(minX, coord.x);
      minY = Math.min(minY, coord.y);
      maxX = Math.max(maxX, coord.x);
      maxY = Math.max(maxY, coord.y);
    }
    const dx = maxX - minX;
    const dy = maxY - minY;
    const dMax = Math.max(dx, dy);
    const zoom = Math.max(0, Math.floor(-Math.log(dMax) / Math.LN2));
    const tilesAtZoom = Math.pow(2, zoom);
    return {
      z: zoom,
      x: Math.floor((minX + maxX) / 2 * tilesAtZoom),
      y: Math.floor((minY + maxY) / 2 * tilesAtZoom),
      extent: [minX, minY, maxX, maxY]
    };
  }

  const { degToRad, radToDeg } = index;
  highPrecision(true);
  identity([]);
  class CameraSync {
    constructor(viewState, cameraType, scene) {
      this.worldMatrix = new Matrix4();
      this.mercatorMatrix = new Matrix4();
      this.labelPlaneMatrix = new Matrix4();
      this.glCoordMatrix = new Matrix4();
      const { width, height } = viewState;
      const fov = radToDeg(Math.atan(3 / 4));
      const nearZ = 0.1;
      const farZ = 1e21;
      this.viewState = viewState;
      this.scene = scene;
      this.scene.matrixAutoUpdate = false;
      this.scene.worldMatrixNeedsUpdate = true;
      this.camera = cameraType === "orthographic" ? new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, nearZ, farZ) : new PerspectiveCamera(fov, width / height, nearZ, farZ);
      this.camera.matrixAutoUpdate = false;
      this.camera.position.z = 600;
      this.setup();
    }
    setup() {
      const { width, height, fov } = this.viewState;
      const maxPitch = degToRad(this.viewState.maxPitch);
      this.camera.aspect = width / height;
      this.halfFov = fov / 2;
      this.cameraToCenterDistance = 0.5 / Math.tan(this.halfFov) * height;
      this.acuteAngle = Math.PI / 2 - maxPitch;
      this.update();
    }
    update() {
      const { width, height, elevation, _horizonShift, worldSize } = this.viewState;
      const center = this.viewState.getCenter();
      const pitch = this.viewState.getPitch();
      const pitchRad = degToRad(pitch);
      const bearing = this.viewState.getBearing();
      const fovRad = this.viewState.getFovRad();
      const cameraPosition = this.viewState.getCameraPosition();
      const halfFov = fovRad / 2;
      const pitchAngle = Math.cos(Math.PI / 2 - pitchRad);
      const groundAngle = Math.PI / 2 + pitchRad;
      this.cameraToCenterDistance = 0.5 / Math.tan(halfFov) * height;
      const point = this.viewState.project(center);
      const rotateMap = new Matrix4().fromRotationZ(Math.PI);
      const scale = new Matrix4().fromScale(new Vector3(-worldSize, worldSize, worldSize));
      const translateMap = new Matrix4().fromTranslation(new Vector3(-point.x, point.y, 0));
      const nz = height / 50;
      const nearZ = Math.max(nz * pitchAngle, nz);
      const fovAboveCenter = fovRad * (0.5 + this.viewState.centerOffset().y / height);
      const pixelsPerMeter = mercatorZfromAltitude(1, center.lat) * worldSize || 1;
      const minElevationInPixels = elevation ? elevation.getMinElevationBelowMSL() * pixelsPerMeter : 0;
      const cameraToSeaLevelDistance = (cameraPosition[2] * worldSize - minElevationInPixels) / Math.cos(pitchRad);
      const topHalfSurfaceDistance = Math.sin(fovAboveCenter) * cameraToSeaLevelDistance / Math.sin(index.clamp(Math.PI - groundAngle - fovAboveCenter, 0.01, Math.PI - 0.01));
      const furthestDistance = pitchAngle * topHalfSurfaceDistance + cameraToSeaLevelDistance;
      const horizonDistance = cameraToSeaLevelDistance * (1 / _horizonShift);
      const farZ = Math.min(furthestDistance * 1.01, horizonDistance);
      this.mercatorMatrix = new Matrix4().scale(new Vector3(worldSize, worldSize, worldSize / pixelsPerMeter));
      const may = new Matrix4().fromTranslation(new Vector3(0, 0, this.cameraToCenterDistance));
      this.labelPlaneMatrix = new Matrix4();
      const m = new Matrix4();
      m.scale(new Vector3(1, -1, 1));
      m.translate(new Vector3(-1, -1, 0));
      m.scale(new Vector3(2 / width, 2 / height, 1));
      this.glCoordMatrix = m;
      this.camera.aspect = width / height;
      this.cameraTranslateZ = this.cameraToCenterDistance;
      if (this.camera instanceof OrthographicCamera) {
        this.camera.projectionMatrix.orthographic(-width / 2, width / 2, height / 2, -height / 2, nearZ, farZ);
      } else {
        this.camera.projectionMatrix.perspective(fovRad, width / height, nearZ, farZ);
      }
      const cameraWorldMatrix = new Matrix4().premultiply(may).premultiply(new Matrix4().fromRotationX(pitchRad)).premultiply(new Matrix4().fromRotationZ(-degToRad(bearing)));
      if (elevation)
        cameraWorldMatrix.elements[14] = cameraPosition[2] * worldSize;
      this.camera.worldMatrix.copy(cameraWorldMatrix);
      this.camera.updateMatrixWorld();
      if (this.scene) {
        this.scene.localMatrix = new ProjectionMatrix().premultiply(rotateMap).premultiply(scale).premultiply(translateMap);
      }
    }
  }

  function getTileProjBounds(tileID) {
    const numTiles = 1 << tileID.z;
    return {
      left: tileID.wrapedX / numTiles,
      top: tileID.wrapedY / numTiles,
      right: (tileID.wrapedX + 1) / numTiles,
      bottom: (tileID.wrapedY + 1) / numTiles
    };
  }
  function getTileBounds(tileID) {
    const { z, x, y } = tileID;
    const wrap = tileID.wrap;
    const numTiles = 1 << z;
    const leftLng = lngFromMercatorX(x / numTiles, wrap);
    const rightLng = lngFromMercatorX((x + 1) / numTiles, wrap);
    const topLat = latFromMercatorY(y / numTiles);
    const bottomLat = latFromMercatorY((y + 1) / numTiles);
    return [leftLng, bottomLat, rightLng, topLat];
  }
  function getExtent(map) {
    const bounds = map?.getBounds();
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();
    const [xmin, ymin, xmax, ymax] = [southWest.lng, southWest.lat, northEast.lng, northEast.lat];
    const minY = Math.max(ymin, -MAX_MERCATOR_LATITUDE);
    const maxY = Math.min(ymax, MAX_MERCATOR_LATITUDE);
    const p0 = fromLngLat({ lng: xmin, lat: maxY });
    const p1 = fromLngLat({ lng: xmax, lat: minY });
    return [p0.x, p0.y, p1.x, p1.y];
  }
  function getClampZoom(options) {
    const z = options.zoom;
    if (void 0 !== options.minzoom && z < options.minzoom) {
      return options.minzoom;
    }
    if (void 0 !== options.maxzoom && options.maxzoom < z) {
      return options.maxzoom;
    }
    return z;
  }

  class ViewState {
    constructor() {
      this.tileSize = 512;
      this.maxPitch = 60;
      this._horizonShift = 0.1;
    }
    /**
     * 获取 gl 宽度
     */
    get width() {
      return this._width;
    }
    /**
     * 获取 gl 高度
     */
    get height() {
      return this._height;
    }
    get fov() {
      return this.getFovRad() / Math.PI * 180;
    }
    get worldSize() {
      const scale = Math.pow(2, this.zoom - 1);
      return this.tileSize * scale;
    }
    getCenter() {
      return this._center;
    }
    getPitch() {
      return 0;
    }
    getBearing() {
      return 0;
    }
    getFovRad() {
      return 0.6435011087932844;
    }
    getCameraPosition() {
      return [0, 0, 0];
    }
    centerOffset() {
      return { x: 0, y: 0 };
    }
    project(lnglat) {
      const lat = index.clamp(lnglat.lat, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
      const x = mercatorXfromLng(lnglat.lng);
      const y = mercatorYfromLat(lat);
      return { x: x * this.worldSize, y: y * this.worldSize, z: 0 };
    }
    get pixelsPerMeter() {
      return mercatorZfromAltitude(1, this._center.lat) * this.worldSize;
    }
    unproject(p) {
      const lng = lngFromMercatorX(p[0]);
      const lat = latFromMercatorY(p[1]);
      return [lng, lat];
    }
    update(state) {
      this._center = state.center;
      this._width = state.width;
      this._height = state.height;
      this.zoom = state.zoom;
    }
  }
  function wrapTile(x, range, includeMax) {
    const max = range[1];
    const min = range[0];
    const d = max - min;
    return {
      x: x === max && includeMax ? x : ((x - min) % d + d) % d + min,
      wrap: Math.floor(x / max)
    };
  }
  class WebglLayer extends BaseLayer {
    initialize(id, source, options) {
      super.initialize(id, source, options);
      this.viewState = new ViewState();
      this._currentTiles = [];
      this._unLimitTiles = [];
      this.source = source;
    }
    _resizeCanvas(scale) {
      super._resizeCanvas(scale);
      if (this.renderer) {
        this.renderer.setSize(this._width, this._height);
      }
      if (this.layer) {
        this.layer.resize(this._width, this._height);
      }
      this._render();
    }
    get camera() {
      return this.sync.camera;
    }
    getTileSize() {
      const s = index.isNumber(this.source.tileSize) ? this.source.tileSize : this.source.tileSize?.[0] || 512;
      return new L__namespace.Point(s, s);
    }
    _redraw() {
      if (this._map && this.source) {
        const tileZoom = getClampZoom({
          zoom: this._map.getZoom(),
          minzoom: this.source.minZoom,
          maxzoom: this.source.maxZoom
        });
        if (tileZoom !== this._tileZoom) {
          this._tileZoom = tileZoom;
        }
        this._update();
      }
      return this;
    }
    _render() {
      if (this._map && this.viewState) {
        this.viewState.update({
          center: this._map.getCenter(),
          zoom: this._map.getZoom(),
          width: this._width,
          height: this._height
        });
      }
      if (!this.gl) {
        this.gl = index.getContext(
          this.canvas,
          {
            preserveDrawingBuffer: false,
            antialias: true,
            // https://bugs.webkit.org/show_bug.cgi?id=237906
            stencil: true
          },
          true
        );
        this.renderer = new Renderer(this.gl, {
          autoClear: false,
          extensions: [
            "OES_texture_float",
            "OES_texture_float_linear",
            "WEBGL_color_buffer_float",
            "EXT_color_buffer_float"
          ]
        });
        this.scene = new Scene();
        this.sync = new CameraSync(this.viewState, "perspective", this.scene);
        this.planeCamera = new OrthographicCamera(0, 1, 1, 0, 0, 1);
        this.layer = new BaseLayer$1(
          this.source,
          {
            renderer: this.renderer,
            scene: this.scene
          },
          {
            renderType: this.options.renderType,
            renderFrom: this.options.renderFrom,
            styleSpec: this.options.styleSpec,
            displayRange: this.options.displayRange,
            widthSegments: this.options.widthSegments,
            heightSegments: this.options.heightSegments,
            wireframe: this.options.wireframe,
            picking: this.options.picking,
            mask: this.processMask(),
            getZoom: () => this.viewState.zoom,
            triggerRepaint: () => {
              requestAnimationFrame(() => this._update());
            },
            getTileProjSize: (z) => {
              const w = 1 / Math.pow(2, z);
              return [w, w];
            },
            getPixelsToUnits: () => {
              const pixel = 1;
              const y = this.canvas.clientHeight / 2 - pixel / 2;
              const x = this.canvas.clientWidth / 2 - pixel / 2;
              const left = fromLngLat(this.viewState.unproject([x, y]));
              const right = fromLngLat(this.viewState.unproject([x + pixel, y + pixel]));
              return [Math.abs(right.x - left.x), Math.abs(left.y - right.y)];
            },
            getPixelsToProjUnit: () => [this.viewState.pixelsPerMeter, this.viewState.pixelsPerMeter],
            getViewTiles: (source, renderType) => {
              let { type } = source;
              type = type !== LayerSourceType.timeline ? type : source.privateType;
              if (!this._map)
                return [];
              const wrapTiles = [];
              if (type === LayerSourceType.image) {
                const cornerCoords = source.coordinates.map((c) => fromLngLat({ lng: c[0], lat: c[1] }));
                const tileID = getCoordinatesCenterTileID(cornerCoords);
                if (source.wrapX) {
                  const x = tileID.x;
                  const y = tileID.y;
                  const z = tileID.z;
                  const wrap = 0;
                  wrapTiles.push(
                    new TileID(z, wrap, z, x, y, {
                      getTileBounds: () => [
                        source.coordinates[0][0],
                        source.coordinates[2][1],
                        source.coordinates[1][0],
                        source.coordinates[0][1]
                      ],
                      getTileProjBounds: () => ({
                        left: tileID.extent[0] + wrap,
                        top: tileID.extent[1],
                        right: tileID.extent[2] + wrap,
                        bottom: tileID.extent[3]
                      })
                    })
                  );
                } else {
                  const x = tileID.x;
                  const y = tileID.y;
                  const z = tileID.z;
                  const wrap = 0;
                  wrapTiles.push(
                    new TileID(z, wrap, z, x, y, {
                      getTileBounds: () => [
                        source.coordinates[0][0],
                        source.coordinates[2][1],
                        source.coordinates[1][0],
                        source.coordinates[0][1]
                      ],
                      getTileProjBounds: () => ({
                        left: tileID.extent[0] + wrap,
                        top: tileID.extent[1],
                        right: tileID.extent[2] + wrap,
                        bottom: tileID.extent[3]
                      })
                    })
                  );
                }
              } else if (type === LayerSourceType.tile) {
                const tiles = this._currentTiles;
                for (let i = 0; i < tiles.length; i++) {
                  const tile = tiles[i];
                  const { x, y, z, wrap } = tile;
                  if (source.wrapX) {
                    wrapTiles.push(
                      new TileID(z, wrap, z, x, y, {
                        getTileBounds,
                        getTileProjBounds
                      })
                    );
                  } else if (tile.wrap === 0) {
                    wrapTiles.push(
                      new TileID(z, wrap, z, x, y, {
                        getTileBounds,
                        getTileProjBounds
                      })
                    );
                  }
                }
              }
              return wrapTiles;
            },
            getExtent: () => getExtent(this._map),
            getGridTiles: (source) => {
              const wrapX = source.wrapX;
              if (!this._map)
                return [];
              const tiles = this._unLimitTiles;
              const wrapTiles = [];
              for (let i = 0; i < tiles.length; i++) {
                const tile = tiles[i];
                const { x, y, z, wrap } = tile;
                if (wrapX) {
                  wrapTiles.push(
                    new TileID(z, wrap, z, x, y, {
                      getTileBounds,
                      getTileProjBounds
                    })
                  );
                } else if (tile.wrap === 0) {
                  wrapTiles.push(
                    new TileID(z, wrap, z, x, y, {
                      getTileBounds,
                      getTileProjBounds
                    })
                  );
                }
              }
              return wrapTiles;
            }
          }
        );
      }
      if (this.sync) {
        this.sync.update();
      }
      if (this.layer) {
        this.layer.update();
      }
      this.glPrerender();
      this.glRender();
    }
    glPrerender() {
      this.scene.worldMatrixNeedsUpdate = true;
      this.scene.updateMatrixWorld();
      this.camera.updateMatrixWorld();
      const worlds = this.calcWrappedWorlds();
      this.layer?.prerender({
        worlds,
        camera: this.camera,
        planeCamera: this.planeCamera
      });
    }
    glRender() {
      this.scene.worldMatrixNeedsUpdate = true;
      this.scene.updateMatrixWorld();
      this.camera.updateMatrixWorld();
      const worlds = this.calcWrappedWorlds();
      this.layer?.render({
        worlds,
        camera: this.camera,
        planeCamera: this.planeCamera
      });
    }
    async picker(coordinates) {
      if (!this.options.picking) {
        console.warn("[Layer]: please enable picking options!");
        return null;
      }
      if (!this.layer || !coordinates || !this._map) {
        console.warn("[Layer]: layer not initialized!");
        return null;
      }
      const point = this._map.project(coordinates);
      return this.layer.picker([point.x, point.y]);
    }
    calcWrappedWorlds() {
      return [0];
    }
    _resetView(e) {
      const animating = e && (e.pinch || e.flyTo);
      this._setView(this._map.getCenter(), this._map.getZoom(), animating, animating);
    }
    _resetGrid() {
      const map = this._map;
      const crs = map.options.crs;
      const tileSize = this.getTileSize();
      const tileZoom = this._tileZoom;
      const bounds = this._map.getPixelWorldBounds(this._tileZoom);
      if (bounds) {
        this._globalTileRange = this._pxBoundsToTileRange(bounds);
      }
      this._wrapX = crs.wrapLng && [
        Math.floor(map.project([0, crs.wrapLng[0]], tileZoom).x / tileSize.x),
        Math.ceil(map.project([0, crs.wrapLng[1]], tileZoom).x / tileSize.y)
      ];
      this._wrapY = crs.wrapLat && [
        Math.floor(map.project([crs.wrapLat[0], 0], tileZoom).y / tileSize.x),
        Math.ceil(map.project([crs.wrapLat[1], 0], tileZoom).y / tileSize.y)
      ];
    }
    _setView(center, zoom, noPrune, noUpdate) {
      let tileZoom = Math.round(zoom);
      if (this.options.maxZoom !== void 0 && tileZoom > this.options.maxZoom || this.options.minZoom !== void 0 && tileZoom < this.options.minZoom) {
        tileZoom = void 0;
      } else {
        tileZoom = getClampZoom({
          minzoom: this.source.minZoom,
          maxzoom: this.source.maxZoom,
          zoom: tileZoom
        });
      }
      const tileZoomChanged = this.options.updateWhenZooming && tileZoom !== this._tileZoom;
      if (!noUpdate || tileZoomChanged) {
        this._tileZoom = tileZoom;
        this._resetGrid();
        if (tileZoom !== void 0) {
          this._update(center);
        }
      }
    }
    _tileCoordsToBounds(coords) {
      const bp = this._tileCoordsToNwSe(coords);
      let bounds = new L__namespace.LatLngBounds(bp[0], bp[1]);
      if (!this.source.wrapX) {
        bounds = this._map.wrapLatLngBounds(bounds);
      }
      return bounds;
    }
    _tileCoordsToNwSe(coords) {
      const map = this._map;
      const tileSize = this.getTileSize();
      const nwPoint = coords.scaleBy(tileSize);
      const sePoint = nwPoint.add(tileSize);
      const nw = map.unproject(nwPoint, coords.z);
      const se = map.unproject(sePoint, coords.z);
      return [nw, se];
    }
    _isValidTile(coords) {
      const crs = this._map.options.crs;
      if (!crs.infinite) {
        const bounds = this._globalTileRange;
        if (!crs.wrapLng && (coords.x < bounds.min.x || coords.x > bounds.max.x) || !crs.wrapLat && (coords.y < bounds.min.y || coords.y > bounds.max.y)) {
          return false;
        }
      }
      return true;
    }
    _wrapCoords(coords) {
      const t = this._wrapX ? wrapTile(coords.x, this._wrapX) : { x: coords.x, wrap: 0 };
      const newCoords = new L__namespace.Point(
        t.x,
        this._wrapY && !this.source.wrapX ? L__namespace.Util.wrapNum(coords.y, this._wrapY) : coords.y
      );
      newCoords.z = coords.z;
      newCoords.wrap = t.wrap;
      return newCoords;
    }
    _update(center) {
      const map = this._map;
      if (!map || !this.source) {
        return;
      }
      const zoom = getClampZoom({
        zoom: map.getZoom(),
        minzoom: this.source.minZoom,
        maxzoom: this.source.maxZoom
      });
      if (center === void 0) {
        center = map.getCenter();
      }
      if (this._tileZoom === void 0) {
        return;
      }
      const pixelBounds = this._getTiledPixelBounds(center, this._tileZoom);
      const tileRange = this._pxBoundsToTileRange(pixelBounds);
      const tileCenter = tileRange.getCenter();
      const queue = [];
      if (!(isFinite(tileRange.min.x) && isFinite(tileRange.min.y) && isFinite(tileRange.max.x) && isFinite(tileRange.max.y))) {
        throw new Error("Attempted to load an infinite number of tiles");
      }
      if (Math.abs(zoom - this._tileZoom) > 1) {
        this._setView(center, zoom);
        return;
      }
      for (let j = tileRange.min.y; j <= tileRange.max.y; j++) {
        for (let i = tileRange.min.x; i <= tileRange.max.x; i++) {
          const coords = new L__namespace.Point(i, j);
          coords.z = this._tileZoom;
          if (!this._isValidTile(coords)) {
            continue;
          }
          queue.push(this._wrapCoords(coords));
        }
      }
      queue.sort((a, b) => a.distanceTo(tileCenter) - b.distanceTo(tileCenter));
      const z = map.getZoom();
      const bounds = this._getTiledPixelBounds(center, z);
      if (bounds) {
        const unLimitTileRange = this._pxBoundsToTileRange(bounds);
        const tc = tileRange.getCenter();
        const tileCoords = [];
        for (let j = unLimitTileRange.min.y; j <= unLimitTileRange.max.y; j++) {
          for (let i = unLimitTileRange.min.x; i <= unLimitTileRange.max.x; i++) {
            const coords = new L__namespace.Point(i, j);
            coords.z = z;
            if (!this._isValidTile(coords)) {
              continue;
            }
            tileCoords.push(this._wrapCoords(coords));
          }
        }
        tileCoords.sort((a, b) => a.distanceTo(tc) - b.distanceTo(tc));
        this._unLimitTiles = tileCoords;
      }
      this._currentTiles = queue;
      this._render();
      return queue;
    }
    _getTiledPixelBounds(center, zoom) {
      const map = this._map;
      const mapZoom = map._animatingZoom ? Math.max(map._animateToZoom, map.getZoom()) : map.getZoom();
      const scale = map.getZoomScale(mapZoom, zoom);
      const pixelCenter = map.project(center, zoom).floor();
      const halfSize = map.getSize().divideBy(scale * 2);
      return new L__namespace.Bounds(pixelCenter.subtract(halfSize), pixelCenter.add(halfSize));
    }
    _pxBoundsToTileRange(bounds) {
      const tileSize = this.getTileSize();
      return new L__namespace.Bounds(
        bounds.min.unscaleBy(tileSize).floor(),
        bounds.max.unscaleBy(tileSize).ceil().subtract([1, 1])
      );
    }
    handleZoom() {
      this._resetView();
      if (this.layer) {
        this.layer.handleZoom();
      }
    }
    onMoveEnd() {
      this._reset();
      if (!this._map || this._map._animatingZoom) {
        return;
      }
      if (this.layer) {
        this.layer.moveEnd();
      }
    }
    onMoveStart() {
      if (this.layer) {
        this.layer.moveStart();
      }
    }
    _animateZoom(event) {
      super._animateZoom(event);
      this._setView(event.center, event.zoom, true, event.noUpdate);
      this.handleZoom();
    }
    getEvents() {
      const events = {
        resize: this._onResize,
        viewreset: this._resetView,
        moveend: this.onMoveEnd,
        movestart: this.onMoveStart,
        zoom: this.handleZoom,
        zoomend: this._reset
      };
      if (this._map.options.zoomAnimation && L__namespace.Browser.any3d) {
        events.zoomanim = this._animateZoom;
      }
      return events;
    }
    updateOptions(options) {
      this.options = {
        ...this.options,
        ...options || {}
      };
      if (this.layer) {
        this.layer.updateOptions(options);
      }
      this._redraw();
    }
    getMask() {
      return this.options.mask;
    }
    processMask() {
      if (this.options.mask) {
        const mask = this.options.mask;
        const data = mask.data;
        rewind$1(data, true);
        const tr = (coords) => {
          const mercatorCoordinates = [];
          for (let i2 = 0; i2 < coords.length; i2++) {
            const coord = coords[i2];
            const p = fromLngLat(coord);
            mercatorCoordinates.push([p.x, p.y]);
          }
          return mercatorCoordinates;
        };
        const features = data.features;
        const len = features.length;
        let i = 0;
        const fs = [];
        for (; i < len; i++) {
          const feature = features[i];
          const coordinates = feature.geometry.coordinates;
          const type = feature.geometry.type;
          if (type === "Polygon") {
            fs.push({
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: feature.geometry.coordinates.map((c) => tr(c))
              }
            });
          } else if (type === "MultiPolygon") {
            const css = [];
            for (let k = 0; k < coordinates.length; k++) {
              const coordinate = coordinates[k];
              const cs = [];
              for (let n = 0; n < coordinate.length; n++) {
                cs.push(tr(coordinates[k][n]));
              }
              css.push(cs);
            }
            fs.push({
              type: "Feature",
              properties: {},
              geometry: {
                type: "MultiPolygon",
                coordinates: css
              }
            });
          }
        }
        return {
          data: polygon2buffer(fs),
          type: mask.type
        };
      }
    }
    setMask(mask) {
      this.options.mask = Object.assign({}, this.options.mask, mask);
      if (this.layer) {
        this.layer.setMask(this.processMask());
      }
    }
    onRemove() {
      if (this.layer) {
        this.layer.destroy();
        this.layer = null;
      }
      if (this.source) {
        if (Array.isArray(this.source.sourceCache)) {
          this.source.sourceCache?.forEach((s) => {
            s?.clearTiles();
          });
        } else {
          this.source.sourceCache?.clearTiles();
        }
      }
      this._currentTiles = [];
      this._unLimitTiles = [];
      this.gl = null;
      this._tileZoom = void 0;
      return super.onRemove();
    }
  }

  exports.DecodeType = DecodeType;
  exports.Field = Field;
  exports.ImageSource = ImageSource;
  exports.LayerSourceType = LayerSourceType;
  exports.MaskType = MaskType;
  exports.RenderFrom = RenderFrom;
  exports.RenderType = RenderType;
  exports.TileID = TileID;
  exports.TileSource = TileSource;
  exports.TimelineSource = TimelineSource;
  exports.WebglLayer = WebglLayer;
  exports.WindLayer = WindLayer;
  exports.configDeps = configDeps;

}));
//# sourceMappingURL=leaflet-wind.js.map
