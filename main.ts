import * as vega from "vega";
import "@mapd/connector/dist/browser-connector";

// todo: remove this hack once the types are up to date
const Transform = (vega as any).Transform;

const connection = new (window as any).MapdCon()
  .protocol("https")
  .host("metis.mapd.com")
  .port("443")
  .dbName("mapd")
  .user("mapd")
  .password("HyperInteractive");

const table = "flights_donotmodify";

async function run() {
  const session = await connection.connectAsync();

  /**
   * A transfrom that loads data from a MapD core database.
   */
  function MapDTransform(params) {
    Transform.call(this, [], params);
  }

  MapDTransform.Definition = {
    type: "MapD",
    metadata: { changes: true },
    params: [{ name: "query", type: "string", required: true }]
  };
  const prototypeData = vega.inherits(MapDTransform as any, Transform) as any;

  prototypeData.transform = async function(_, pulse) {
    console.log("query", _.query);

    const result = await session.queryAsync(_.query);
    console.log("result", result);

    const out = pulse.fork(pulse.NO_FIELDS & pulse.NO_SOURCE);
    out.rem = this.value;
    this.value = out.add = out.source = result;
    return out;
  };

  // add mapd transforms
  (vega as any).transforms["mapd"] = MapDTransform;

  const runtime = vega.parse(spec);
  const view = await new vega.View(runtime)
    .logLevel(vega.Info)
    .renderer("svg")
    .initialize(document.querySelector("#view"))
    .runAsync();

  console.log(view);
}

// transform to compute the extent
const extentMapD = {
  type: "mapd",
  query: `select min(airtime) as "min", max(airtime) as "max" from ${table}`
} as any;

// transform to bin and aggregate
const dataMapD = {
  type: "mapd",
  query: {
    signal: `'select ' + bins.step + ' * floor((airtime-cast(' + bins.start + ' as float))/' + bins.step + ') as "bin_start", count(*) as "cnt" from ${table} where airtime between ' + bins.start + ' and ' + bins.stop + ' group by bin_start'`
  }
} as any;

const spec: vega.Spec = {
  $schema: "https://vega.github.io/schema/vega/v5.json",
  autosize: "pad",
  padding: 5,
  width: 600,
  height: 250,
  signals: [
    { name: "maxbins", value: 20, bind: { min: 1, max: 300, type: "range" } },
    {
      name: "extent",
      update: "[data('extent')[0]['min'], data('extent')[0]['max']]"
    }
  ],
  data: [
    {
      name: "extent",
      transform: [extentMapD]
    },
    {
      name: "bin",
      transform: [
        // this bin transform doesn't actually bin any data, it just computea the bins signal
        {
          type: "bin",
          field: null,
          signal: "bins",
          maxbins: { signal: "maxbins" },
          extent: { signal: "extent" }
        }
      ]
    },
    {
      name: "table",
      transform: [
        dataMapD,
        {
          type: "formula",
          expr: "datum.bin_start + bins.step",
          as: "bin_end"
        }
      ]
    }
  ],
  marks: [
    {
      name: "marks",
      type: "rect",
      from: { data: "table" },
      encode: {
        update: {
          fill: { value: "steelblue" },
          x2: { scale: "x", field: "bin_start", offset: 1 },
          x: { scale: "x", field: "bin_end" },
          y: { scale: "y", field: "cnt" },
          y2: { scale: "y", value: 0 }
        }
      }
    }
  ],
  scales: [
    {
      name: "x",
      type: "linear",
      domain: {
        signal: "[bins.start, bins.stop]"
      },
      range: [0, { signal: "width" }],
      zero: false,
      bins: { signal: "sequence(bins.start, bins.stop + bins.step, bins.step)" }
    },
    {
      name: "y",
      type: "linear",
      domain: { data: "table", field: "cnt" },
      range: [{ signal: "height" }, 0],
      nice: true,
      zero: true
    }
  ],
  axes: [
    {
      scale: "x",
      orient: "bottom",
      grid: false,
      title: "Binned Value",
      labelFlush: true,
      labelOverlap: true
    },
    {
      scale: "y",
      orient: "left",
      grid: true,
      title: "Count of Records",
      labelOverlap: true,
      gridOpacity: 0.7
    }
  ],
  config: { axisY: { minExtent: 30 } }
};

run();
