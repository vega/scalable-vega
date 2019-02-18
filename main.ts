import "@mapd/connector/dist/browser-connector";
import * as vega from "@domoritz/vega";

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
   * A transfrom that creates a dataset.
   */
  function MapD(params) {
    vega.Transform.call(this, [], params);
  }
  MapD.Definition = {
    type: "MapD",
    metadata: { changes: true },
    params: [{ name: "query", type: "string", required: true }]
  };
  const prototypeData = vega.inherits(MapD, vega.Transform);
  prototypeData.transform = async function(_, pulse) {
    console.log(_);
    console.log(pulse);

    const result = await session.queryAsync(_.query);
    console.log(result);

    const out = pulse.fork(pulse.NO_SOURCE);

    out.add = out.source = result;
    return out;
  };

  // add mapd transforms
  vega.transforms["mapd"] = MapD;

  const runtime = vega.parse(spec);
  const view = new vega.View(runtime)
    .initialize(document.querySelector("#view"))
    .run();

  console.log(view);
}

// transform to compute the extent
const extentMapD = {
  type: "mapd",
  query: {
    signal: `'select min(airtime) as "min", max(airtime) as "max" from ${table}'`
  }
} as any;

// transform to compute the extent
const dataMapD = {
  type: "mapd",
  query: {
    signal: `'select airtime as "value" from ${table} where airtime is not null limit 1000'`
  }
} as any;

const spec: vega.Spec = {
  $schema: "https://vega.github.io/schema/vega/v4.json",
  autosize: "pad",
  padding: 5,
  width: 600,
  height: 250,
  signals: [
    { name: "maxbins", value: 20, bind: { min: 1, max: 200, type: "range" } },
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
      name: "table",
      transform: [
        dataMapD,
        {
          type: "bin",
          field: "value",
          as: ["bin_start", "bin_end"],
          signal: "bins",
          maxbins: { signal: "maxbins" },
          extent: { signal: "extent" }
        },
        {
          type: "aggregate",
          groupby: ["bin_start", "bin_end"],
          ops: ["count"],
          fields: [null],
          as: ["cnt"]
        }
      ]
    }
  ],
  marks: [
    {
      name: "marks",
      type: "rect",
      style: ["bar"],
      from: { data: "table" },
      encode: {
        update: {
          fill: { value: "#4c78a8" },
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
