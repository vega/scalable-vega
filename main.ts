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
  function MapDData(params) {
    vega.Transform.call(this, [], params);
  }
  MapDData.Definition = {
    type: "MapD_Data",
    metadata: { changes: true },
    params: [{ name: "query", type: "string", required: true }]
  };
  const prototypeData = vega.inherits(MapDData, vega.Transform);
  prototypeData.transform = async function(_, pulse) {
    console.log(_);
    console.log(pulse);

    const result = await session.queryAsync(_.query);
    console.log(result);

    const out = pulse.fork(pulse.NO_FIELDS & pulse.NO_SOURCE);

    out.add = out.source = result;
    return out;
  };

  /**
   * A transform that sets a signals.
   */
  function MapDSignal(params) {
    vega.Transform.call(this, null, params);
  }
  MapDSignal.Definition = {
    type: "MapD_Signal",
    metadata: { changes: true },
    params: [
      { name: "query", type: "string", required: true },
      { name: "signal", type: "string", required: true },
      { name: "array", type: "boolean" }
    ]
  };
  const prototypeSignals = vega.inherits(MapDSignal, vega.Transform);
  prototypeSignals.transform = async function(_, pulse) {
    console.log(_);
    console.log(pulse);

    let result = await session.queryAsync(_.query);

    if (_.array) {
      // convert query result to an array
      result = result.map(d => {
        const arr = [];
        Object.keys(d).forEach(k => {
          arr[+k] = d[k];
        });
        return arr;
      });

      // we treat results with one row as a flat table
      if (result.length === 1) {
        result = result[0];
      }
    }

    console.log(result);
    this.value = result;
  };

  // add mapd transforms
  vega.transforms["mapd_data"] = MapDData;
  vega.transforms["mapd_signal"] = MapDSignal;

  const runtime = vega.parse(spec);
  const view = new vega.View(runtime)
    .initialize(document.querySelector("#view"))
    .run();

  console.log(view);
}

// transform to compute the extent
const extentMapD = {
  type: "mapd_signal",
  query: {
    signal: `'select min(airtime) as "0", max(airtime) as "1" from ${table}'`
  },
  signal: "extent",
  array: true
} as any;

// transform to compute the extent
const dataMapD = {
  type: "mapd_data",
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
    { name: "maxbins", value: 20, bind: { min: 1, max: 200, type: "range" } }
  ],
  data: [
    {
      name: "source",
      transform: [dataMapD]
    },
    {
      name: "extent",
      transform: [extentMapD]
    },
    {
      name: "table",
      source: "source",
      transform: [
        // {
        //   type: "extent",
        //   field: "value",
        //   signal: "extent"
        // },
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
