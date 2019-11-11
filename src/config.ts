import { values, each, keys } from "lodash";

export const dbNames = {
  ArchiveDB: "ArchiveDB",
  CorporateActionsDB: "CorporateActionsDB",
  OrgSeriesDB: "OrgSeriesDB",
  OrgDynamicAggregateSeriesDB: "OrgDynamicAggregateSeriesDB",
  OrgStaticAggregateSeriesDB: "OrgStaticAggregateSeriesDB",
  QikSayDB: "QikSayDB",
  SasbAsset4DB: "SasbAsset4DB",
  TVLArticlesDB: "TVLArticlesDB",
  TVLSSODB: "TVLSSODB",
  twitterDB: "twitterDB",
  XmanDB: "XmanDB",
  XmanSasbv2ArticlesDB: "XmanSasbv2ArticlesDB",
  DiagnosticArticlesDB: "DiagnosticArticlesDB"
};

const startTunnelPortsFrom = 27020;
const allDbs = values(dbNames);

const series = [
  "OrgSeriesDB",
  "OrgDynamicAggregateSeriesDB",
  "OrgStaticAggregateSeriesDB"
];

const settings = {
  vagrant: [
    {
      url: "mongodb://localhost:27017",
      dbNames: allDbs
    }
  ],
  development: [
    {
      url: "dev-i360-v2-app2.tvl.ai",
      tunnel: true,
      dbNames: allDbs
    }
  ],
  staging: [
    {
      url: "staging-i360-v2-rtd1x.tvl.ai",
      tunnel: true,
      dbNames: ["QikSayDB"]
    },
    {
      url: "staging-i360-v2-abadb1x.tvl.ai",
      tunnel: true,
      dbNames: series
    },
    {
      url: "staging-i360-v2-archivedb1.tvl.ai",
      tunnel: true,
      dbNames: ["ArchiveDB"]
    },
    {
      url: "staging-i360-v2-articlesdb1x.tvl.ai",
      tunnel: true,
      dbNames: ["TVLArticlesDB"]
    }
  ],
  production: [
    {
      url: "prod-i360-v2-rtd1x.tvl.ai",
      tunnel: true,
      dbNames: ["QikSayDB"]
    },
    {
      url: "prod-i360-v2-abadb1x.tvl.ai",
      tunnel: true,
      dbNames: series
    },
    {
      url: "prod-i360-v2-archivedb1.tvl.ai",
      tunnel: true,
      dbNames: ["ArchiveDB"]
    },
    {
      url: "prod-i360-v2-articlesdb1x.tvl.ai",
      tunnel: true,
      dbNames: ["TVLArticlesDB"]
    }
  ]
};

function normalizeSettings(settings: any): any {
  let port = startTunnelPortsFrom;
  const result: any = {};
  each(settings, (urlSettings, env) => {
    const envSettings: any = {};
    each(urlSettings, ({ url, tunnel, dbNames }) => {
      each(dbNames, dbName => {
        envSettings[dbName] = { url, tunnel, dbName, env };
        if (tunnel) {
          envSettings[dbName].port = port;
          port += 1;
        }
      });
    });
    result[env] = envSettings;
  });
  return result;
}

export const environments = keys(settings);
export const databases = normalizeSettings(settings);
