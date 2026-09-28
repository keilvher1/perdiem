# Kiln API calls by flow

Generated 2026-09-28T13:11:30.135Z by `scripts/metrics.ts` from `logs/dev-server.log`, `docs/reasoning-comparison.kiln.jsonl`.
Scope: only the calls in these log files (one server session plus the compare run). `/metrics` and `evidence/metrics.md` count every row in `usage_records`, i.e. every call ever recorded in the database, so their call counts are larger by design.
Every line comes from `lib/kiln.ts::chatWithUsage()`, which prints one JSON line per real call to Kiln (`https://api.bricksum.com/v1`, model `qwen3-32b`): the Kiln response id, the tool calls the model made, and the `usage` block Kiln returned. Raw lines: `evidence/06-kiln-calls.txt`.

## Summary

| Flow | Kiln calls | Tool calls | Prompt | Cached prompt | Completion | Reasoning | Total | Cost (USD) |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| `propose` | 21 | propose_payment ×21 | 9,828 | 9,307 | 969 | 21 | 10,797 | $0.000685 |
| `compare` | 10 | propose_payment ×10 | 4,676 | 4,626 | 1,007 | 545 | 5,683 | $0.000471 |
| **all** | **31** | | **14,504** | | **1,976** | | **16,480** | **$0.001156** |

Flows answered **without** calling the model (recorded as 0-token rows by `zeroUsage()`, so they appear in `/metrics` but never in the Kiln log; counts from `/api/usage`, i.e. all rows in `usage_records`, not only this log):

- `status_fastpath`: 3 request(s) answered from the ledger, 0 tokens
- `stop_template`: 15 refusal(s) explained from a template, 0 tokens

## Flow `propose` — 21 call(s)

| # | Kiln response id | Tool call (arguments) | Finish | Prompt | Cached | Completion | Reasoning | Cost (USD) |
|---:|---|---|---|---:|---:|---:|---:|---:|
| 1 | `chat-6a02916dade74d85b7bcd80493cab52b` | `propose_payment` `{"amount_usd": 12, "memo": "Order a bibimbap lunch", "merchant_id": "m1"}` | tool_calls | 473 | 5 | 47 | 1 | $0.000051 |
| 2 | `chat-d7b6d11667a84d1e8430d56643ff4351` | `propose_payment` `{"amount_usd": 85, "memo": "Taxi to Incheon airport", "merchant_id": "m2"}` | tool_calls | 469 | 468 | 47 | 1 | $0.000032 |
| 3 | `chat-fad51633c544439faeb3f7bf8d1678d6` | `propose_payment` `{"amount_usd": 30, "memo": "Buy a bottle of wine as a gift for the client", "merchant_id": "m5"}` | tool_calls | 473 | 472 | 52 | 1 | $0.000034 |
| 4 | `chat-396acb73283d4496b2aa299a0b0965f9` | `propose_payment` `{"amount_usd": 10, "memo": "Dinner from Yangjae Kitchen", "merchant_id": "m1"}` | tool_calls | 469 | 468 | 48 | 1 | $0.000032 |
| 5 | `chat-7f06d578ae3c425fac536b0f8678d0c7` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | tool_calls | 464 | 449 | 43 | 1 | $0.000031 |
| 6 | `chat-33f545e950354a5397b4172f8d9b1895` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | tool_calls | 464 | 463 | 43 | 1 | $0.000031 |
| 7 | `chat-3058728bdda0476087983bb638af2df0` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | tool_calls | 464 | 463 | 43 | 1 | $0.000031 |
| 8 | `chat-1fd31f6c0ec043c092474eaa029eddd6` | `propose_payment` `{"amount_usd": 12, "memo": "Order a bibimbap lunch", "merchant_id": "m1"}` | tool_calls | 473 | 472 | 47 | 1 | $0.000032 |
| 9 | `chat-998b61e1bce54eb68d0d1ca6012de5be` | `propose_payment` `{"amount_usd": 85, "memo": "Taxi to Incheon airport", "merchant_id": "m2"}` | tool_calls | 469 | 449 | 47 | 1 | $0.000033 |
| 10 | `chat-2f7c6ccf4482474e99b4c11ee63670da` | `propose_payment` `{"amount_usd": 30, "memo": "Buy a bottle of wine as a gift for the client", "merchant_id": "m5"}` | tool_calls | 473 | 472 | 52 | 1 | $0.000034 |
| 11 | `chat-2d87f2ae444442508e3b0bd63de12870` | `propose_payment` `{"amount_usd": 10, "memo": "Dinner from Yangjae Kitchen", "merchant_id": "m1"}` | tool_calls | 469 | 468 | 48 | 1 | $0.000032 |
| 12 | `chat-fd99ee957ee344efa93170584996546a` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | tool_calls | 464 | 463 | 43 | 1 | $0.000031 |
| 13 | `chat-560107b5f9ab498b8ab97ebb6a8737ba` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | tool_calls | 464 | 463 | 43 | 1 | $0.000031 |
| 14 | `chat-57c5f78ae9664e1ab4f8f2eb1f57adad` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | tool_calls | 464 | 463 | 43 | 1 | $0.000031 |
| 15 | `chat-e1a8c85b648e4224b0499f66b81843ff` | `propose_payment` `{"amount_usd": 12, "memo": "Order a bibimbap lunch", "merchant_id": "m1"}` | tool_calls | 473 | 472 | 47 | 1 | $0.000032 |
| 16 | `chat-8eec65d844344113ae74821c16c1aa5a` | `propose_payment` `{"amount_usd": 85, "memo": "Taxi to Incheon airport", "merchant_id": "m2"}` | tool_calls | 469 | 468 | 47 | 1 | $0.000032 |
| 17 | `chat-740fed26281c4107b531e2642e48c982` | `propose_payment` `{"amount_usd": 30, "memo": "Buy a bottle of wine as a gift for the client", "merchant_id": "m5"}` | tool_calls | 473 | 472 | 52 | 1 | $0.000034 |
| 18 | `chat-ce1b29462c4849eb9108499546a51353` | `propose_payment` `{"amount_usd": 10, "memo": "Dinner from Yangjae Kitchen", "merchant_id": "m1"}` | tool_calls | 469 | 468 | 48 | 1 | $0.000032 |
| 19 | `chat-ea2322aa07044e16a3ce04309735fc56` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | tool_calls | 464 | 463 | 43 | 1 | $0.000031 |
| 20 | `chat-d94b397a08f443269950872e1c899ec4` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | tool_calls | 464 | 463 | 43 | 1 | $0.000031 |
| 21 | `chat-c8b1a175312840cd8425c2213051beb8` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | tool_calls | 464 | 463 | 43 | 1 | $0.000031 |

## Flow `compare` — 10 call(s)

| # | Kiln response id | Tool call (arguments) | Finish | Prompt | Cached | Completion | Reasoning | Cost (USD) |
|---:|---|---|---|---:|---:|---:|---:|---:|
| 1 | `chat-bbb2cb0862664eebb625412a5fdede22` | `propose_payment` `{"amount_usd": 12, "memo": "bibimbap lunch", "merchant_id": "m1"}` | tool_calls | 469 | 468 | 154 | 110 | $0.000062 |
| 2 | `chat-b2d07c39e53c4795ba915fc5dd2f6af5` | `propose_payment` `{"amount_usd": 12, "memo": "Order a bibimbap lunch", "merchant_id": "m1"}` | tool_calls | 473 | 464 | 47 | 1 | $0.000032 |
| 3 | `chat-0b033e96ff4d4c1e91bb47aa5a89c2c2` | `propose_payment` `{"amount_usd": 85, "memo": "Taxi to Incheon airport", "merchant_id": "m2"}` | tool_calls | 469 | 460 | 47 | 1 | $0.000032 |
| 4 | `chat-9a89541f1053478fa7d59c50fd65789f` | `propose_payment` `{"amount_usd": 85, "memo": "Taxi to Incheon airport", "merchant_id": "m2"}` | tool_calls | 465 | 464 | 147 | 101 | $0.000060 |
| 5 | `chat-75530a26a62f4e349f18f7ad215792b0` | `propose_payment` `{"amount_usd": 30, "memo": "Buy a bottle of wine as a gift for the client", "merchant_id": "m5"}` | tool_calls | 469 | 468 | 159 | 108 | $0.000063 |
| 6 | `chat-e19c3addb80e48b9b85bb0ba8bff13f4` | `propose_payment` `{"amount_usd": 30, "memo": "Buy a bottle of wine as a gift for the client", "merchant_id": "m5"}` | tool_calls | 473 | 464 | 52 | 1 | $0.000034 |
| 7 | `chat-d309d000f31c4e3983c3452f996a3027` | `propose_payment` `{"amount_usd": 10, "memo": "Dinner from Yangjae Kitchen", "merchant_id": "m1"}` | tool_calls | 469 | 460 | 48 | 1 | $0.000033 |
| 8 | `chat-eab6c4869b1e4a708c5c6d272db5718f` | `propose_payment` `{"amount_usd": 10, "memo": "Dinner from Yangjae Kitchen", "merchant_id": "m1"}` | tool_calls | 465 | 464 | 180 | 133 | $0.000069 |
| 9 | `chat-a74b17d10de54229980cc4bfb2edba07` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | tool_calls | 460 | 459 | 130 | 88 | $0.000055 |
| 10 | `chat-5f5481f5ea1d4ac7835f235d92cfe112` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | tool_calls | 464 | 455 | 43 | 1 | $0.000031 |
