export interface IIpaSearchOffice {
  code: string;
  description: string;
  pec: string;
}

export interface IIpaSearchSource {
  ipa: string;
  description: string;
  pec: string;
  office: ReadonlyArray<IIpaSearchOffice>;
}

export interface IIpaSearchResponseBody {
  took: number;
  timed_out: boolean;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  hits: {
    total: number;
    max_score: number;
    hits: ReadonlyArray<{
      _index: string;
      _type: string;
      _id: string;
      _score: number;
      _source: IIpaSearchSource;
    }>;
  };
}

export interface IIpaSearchResult {
  ipa: string;
  description: string;
  pec: string;
}
