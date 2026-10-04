# Отчёт о состоянии контента

Каталог `content-legacy`. Сгенерирован `node tools/check-all.js` 2026-10-04. Проверка: `tools/check-page.js` (jsdom + настоящий Chart.js 4.4.1 + заглушка canvas).

**Итого:** 76 страниц, без проблем — 72, с проблемами — 4.

Колонки: секции (`id="sN"`), Q&A (`details.qa` + `div.qa`), графики (создано / `canvas#c_*`), CDN — Chart.js грузится с CDN.

| Файл | КБ | Секции | Q&A | Графики | CDN | Код | Проблемы |
|---|--:|--:|--:|---|:-:|:-:|---|
| block0_01_expectation_variance.html | 1452 | 15 | 30 | 15 / 15 |  | 0 |  |
| block0_02_distributions.html | 1243 | 15 | 30 | 13 / 13 |  | 0 |  |
| block0_03_bayes.html | 1213 | 15 | 30 | 11 / 11 |  | 0 |  |
| block0_04_lln_clt.html | 1169 | 15 | 30 | 13 / 13 |  | 0 |  |
| block0_plan.html | 80 | 0 | 0 | 0 / 0 |  | 0 |  |
| block1_01_gradient_boosting.html | 210 | 15 | 30 | 12 / 12 | да | 0 |  |
| block1_02_class_imbalance.html | 208 | 15 | 30 | 13 / 13 | да | 0 |  |
| block1_03_uplift.html | 202 | 17 | 32 | 5 / 5 | да | 0 |  |
| block1_04_shap.html | 189 | 15 | 30 | 15 / 15 | да | 0 |  |
| block1_05_survival.html | 179 | 14 | 30 | 6 / 6 | да | 0 |  |
| block1_06_anomaly.html | 175 | 14 | 30 | 8 / 8 | да | 0 |  |
| block1_07_calibration.html | 219 | 15 | 30 | 16 / 16 | да | 0 |  |
| block1_08_conformal.html | 211 | 15 | 30 | 16 / 16 | да | 0 |  |
| block1_09_leakage.html | 204 | 15 | 30 | 14 / 14 | да | 0 |  |
| block1_10_ensembles.html | 177 | 15 | 30 | 12 / 12 | да | 0 |  |
| block1_11_missing.html | 188 | 15 | 30 | 12 / 12 | да | 0 |  |
| block1_12_metrics_framing.html | 167 | 15 | 30 | 13 / 13 | да | 0 |  |
| block1_13_feedback_loops.html | 158 | 15 | 30 | 9 / 9 | да | 0 |  |
| block1_14_feature_engineering.html | 153 | 15 | 30 | 11 / 11 | да | 0 |  |
| block1_15_validation_schemes.html | 176 | 15 | 30 | 12 / 12 | да | 0 |  |
| block1_quiz.html | 17 | 0 | 0 | 0 / 0 |  | 0 |  |
| block2_01_rfm.html | 175 | 16 | 30 | 7 / 7 | да | 0 |  |
| block2_02_churn_prediction.html | 185 | 16 | 32 | 7 / 7 | да | 0 |  |
| block2_03_churn_survival.html | 178 | 15 | 30 | 8 / 8 | да | 0 |  |
| block2_04_uplift_retention.html | 197 | 15 | 32 | 9 / 9 | да | 0 |  |
| block2_05_nbo.html | 172 | 15 | 30 | 8 / 8 | да | 0 |  |
| block2_06_basket_analysis.html | 170 | 15 | 30 | 9 / 9 | да | 0 |  |
| block2_07_attribution_mmm.html | 211 | 15 | 30 | 12 / 12 | да | 0 |  |
| block2_08_behavioral_segmentation.html | 190 | 15 | 30 | 13 / 13 | да | 2 | div 545/546 |
| block2_09_uplift_economics.html | 206 | 15 | 30 | 12 / 12 | да | 0 |  |
| block2_10_subscription_b2b.html | 196 | 15 | 30 | 14 / 14 | да | 0 |  |
| block2_11_hierarchical_clv.html | 175 | 15 | 30 | 14 / 14 | да | 0 |  |
| block2_quiz.html | 17 | 0 | 0 | 0 / 0 |  | 0 |  |
| block3_01_dynamic_pricing.html | 87 | 0 | 12 | 7 / 7 | да | 0 |  |
| block3_02_demand_forecasting.html | 87 | 0 | 12 | 5 / 5 | да | 0 |  |
| block3_03_fraud_detection.html | 74 | 0 | 12 | 5 / 5 | да | 0 |  |
| block3_04_ltv_prediction.html | 75 | 0 | 12 | 4 / 4 | да | 0 |  |
| block3_quiz.html | 52 | 0 | 0 | 0 / 0 |  | 0 |  |
| block4_01_ab_testing.html | 151 | 15 | 30 | 14 / 14 | да | 0 |  |
| block4_02_cuped.html | 124 | 15 | 30 | 13 / 13 | да | 2 | div 261/262 |
| block4_03_switchback.html | 124 | 15 | 30 | 12 / 12 | да | 0 |  |
| block4_04_causal_ml.html | 132 | 15 | 30 | 13 / 13 | да | 2 | div 280/281 |
| block4_05_sequential_testing.html | 197 | 15 | 30 | 15 / 15 | да | 0 |  |
| block4_06_srm_diagnostics.html | 181 | 15 | 30 | 13 / 13 | да | 0 |  |
| block4_quiz.html | 16 | 0 | 0 | 0 / 0 |  | 0 |  |
| block6_01_collab_filtering.html | 276 | 15 | 30 | 14 / 14 | да | 0 |  |
| block6_02_two_tower.html | 225 | 15 | 30 | 12 / 12 | да | 2 | div 671/670 |
| block6_03_cold_start.html | 249 | 15 | 30 | 13 / 13 | да | 0 |  |
| block6_04_graph_ml.html | 228 | 15 | 30 | 12 / 12 | да | 0 |  |
| block6_05_system_design.html | 256 | 15 | 30 | 12 / 12 | да | 0 |  |
| block6_06_sequential_rec.html | 160 | 15 | 30 | 11 / 11 | да | 0 |  |
| block6_07_generative_retrieval.html | 148 | 15 | 30 | 12 / 12 | да | 0 |  |
| block6_quiz.html | 16 | 0 | 0 | 0 / 0 |  | 0 |  |
| block7_01_automl.html | 133 | 11 | 20 | 6 / 6 | да | 0 |  |
| block7_02_tabular_dl.html | 123 | 10 | 20 | 4 / 4 | да | 0 |  |
| block7_03_mlops.html | 127 | 10 | 22 | 4 / 4 | да | 0 |  |
| block7_04_tabpfn.html | 164 | 15 | 30 | 13 / 13 | да | 0 |  |
| block7_quiz.html | 99 | 0 | 0 | 0 / 0 |  | 0 |  |
| block8_01_backprop.html | 109 | 9 | 20 | 2 / 2 | да | 0 |  |
| block8_02_optimizers.html | 112 | 10 | 20 | 6 / 6 | да | 0 |  |
| block8_03_normalization.html | 110 | 9 | 21 | 3 / 3 | да | 0 |  |
| block8_04_attention.html | 190 | 16 | 32 | 5 / 5 | да | 0 |  |
| block8_05_scaling.html | 185 | 16 | 30 | 7 / 7 | да | 0 |  |
| block8_06_ssl.html | 175 | 15 | 30 | 7 / 7 | да | 0 |  |
| block8_07_rope_positions.html | 167 | 15 | 30 | 12 / 12 | да | 0 |  |
| block8_08_attention_inference.html | 172 | 15 | 30 | 14 / 14 | да | 0 |  |
| block8_09_moe.html | 159 | 15 | 30 | 12 / 12 | да | 0 |  |
| block8_quiz.html | 17 | 0 | 0 | 0 / 0 |  | 0 |  |
| block9_01_tokenization_embeddings.html | 161 | 15 | 30 | 8 / 8 | да | 0 |  |
| block9_02_search_ranking.html | 162 | 15 | 30 | 8 / 8 | да | 0 |  |
| block9_03_llm.html | 158 | 15 | 30 | 7 / 7 | да | 0 |  |
| block9_04_rag.html | 150 | 15 | 30 | 10 / 10 | да | 0 |  |
| block9_05_finetuning.html | 255 | 15 | 30 | 15 / 15 | да | 0 |  |
| block9_06_agents.html | 240 | 15 | 30 | 13 / 13 | да | 0 |  |
| block9_quiz.html | 16 | 0 | 0 | 0 / 0 |  | 0 |  |
| index_roadmap.html | 58 | 0 | 0 | 0 / 0 |  | 0 |  |
