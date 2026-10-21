# Отчёт о состоянии контента

Каталог `content-legacy`. Сгенерирован `node tools/check-all.js` 2026-10-21. Проверка: `tools/check-page.js` (jsdom + настоящий Chart.js 4.4.1 + заглушка canvas).

**Итого:** 120 страниц, без проблем — 120, с проблемами — 0.

Колонки: секции (`id="sN"`), Q&A (`details.qa` + `div.qa`), графики (создано / `canvas#c_*`), CDN — Chart.js грузится с CDN.

| Файл | КБ | Секции | Q&A | Графики | CDN | Код | Проблемы |
|---|--:|--:|--:|---|:-:|:-:|---|
| block0_01_expectation_variance.html | 2094 | 15 | 30 | 15 / 15 |  | 0 |  |
| block0_02_distributions.html | 1704 | 15 | 30 | 13 / 13 |  | 0 |  |
| block0_03_bayes.html | 1653 | 15 | 30 | 11 / 11 |  | 0 |  |
| block0_04_lln_clt.html | 1511 | 15 | 30 | 13 / 13 |  | 0 |  |
| block0_05_likelihood_mle_map.html | 1775 | 15 | 30 | 16 / 16 |  | 0 |  |
| block0_06_hypothesis_testing.html | 1425 | 15 | 30 | 13 / 13 |  | 0 |  |
| block0_07_entropy_kl.html | 1661 | 15 | 30 | 13 / 13 |  | 0 |  |
| block0_08_linear_algebra.html | 1881 | 15 | 30 | 16 / 16 |  | 0 |  |
| block0_09_gradients.html | 1995 | 15 | 30 | 15 / 15 |  | 0 |  |
| block0_10_convexity.html | 1845 | 15 | 30 | 16 / 16 |  | 0 |  |
| block0_11_learning_setup.html | 1610 | 15 | 30 | 16 / 16 |  | 0 |  |
| block0_12_linear_regression.html | 1880 | 15 | 30 | 14 / 14 |  | 0 |  |
| block0_13_logistic_regression.html | 1928 | 15 | 30 | 14 / 14 |  | 0 |  |
| block0_14_loss_functions.html | 1744 | 15 | 30 | 16 / 16 |  | 0 |  |
| block0_15_regularization.html | 1937 | 15 | 30 | 16 / 16 |  | 0 |  |
| block0_16_optimization.html | 2165 | 15 | 30 | 16 / 16 |  | 0 |  |
| block0_17_metrics_basics.html | 1725 | 15 | 30 | 16 / 16 |  | 0 |  |
| block0_18_data_preparation.html | 1489 | 15 | 30 | 12 / 12 |  | 0 |  |
| block0_19_decision_trees.html | 1824 | 15 | 30 | 15 / 15 |  | 0 |  |
| block0_20_bagging_random_forest.html | 1703 | 15 | 30 | 15 / 15 |  | 0 |  |
| block0_21_gradient_boosting.html | 1733 | 15 | 30 | 16 / 16 |  | 0 |  |
| block0_22_xgboost_math.html | 2114 | 15 | 30 | 14 / 14 |  | 0 |  |
| block0_23_lightgbm_catboost.html | 1722 | 15 | 30 | 13 / 13 |  | 0 |  |
| block0_24_boosting_practice.html | 973 | 15 | 20 | 8 / 8 |  | 0 |  |
| block0_plan.html | 80 | 0 | 0 | 0 / 0 |  | 0 |  |
| block10_01_ml_setup.html | 697 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_02_statistics.html | 764 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_03_losses.html | 713 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_04_gradients.html | 729 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_05_linear_regression.html | 725 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_06_logistic_regression.html | 728 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_07_metrics.html | 687 | 10 | 0 | 2 / 2 |  | 0 |  |
| block10_08_data_features.html | 676 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_09_validation.html | 648 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_10_trees_forest.html | 682 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_11_boosting.html | 690 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_12_imbalance_shap.html | 679 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_13_ab_tests.html | 701 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_14_time_series.html | 676 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_15_recsys.html | 692 | 10 | 0 | 1 / 1 |  | 0 |  |
| block10_16_neural_llm.html | 676 | 10 | 0 | 1 / 1 |  | 0 |  |
| block1_01_validation_schemes.html | 919 | 15 | 20 | 6 / 6 |  | 0 |  |
| block1_02_feature_engineering.html | 894 | 15 | 20 | 7 / 7 |  | 0 |  |
| block1_03_shap.html | 1056 | 15 | 20 | 7 / 7 |  | 0 |  |
| block1_04_leakage.html | 929 | 15 | 20 | 7 / 7 |  | 0 |  |
| block1_05_missing.html | 188 | 15 | 30 | 12 / 12 | да | 0 |  |
| block1_06_class_imbalance.html | 208 | 15 | 30 | 13 / 13 | да | 0 |  |
| block1_07_calibration.html | 219 | 15 | 30 | 16 / 16 | да | 0 |  |
| block1_08_ensembles.html | 177 | 15 | 30 | 12 / 12 | да | 0 |  |
| block1_09_automl.html | 133 | 11 | 20 | 6 / 6 | да | 0 |  |
| block1_10_metrics_framing.html | 167 | 15 | 30 | 13 / 13 | да | 0 |  |
| block1_11_mlops.html | 127 | 10 | 22 | 4 / 4 | да | 0 |  |
| block1_12_conformal.html | 211 | 15 | 30 | 16 / 16 | да | 0 |  |
| block1_13_gradient_boosting.html | 210 | 15 | 30 | 12 / 12 | да | 0 |  |
| block1_quiz.html | 17 | 0 | 0 | 0 / 0 |  | 0 |  |
| block2_01_ab_testing.html | 151 | 15 | 30 | 14 / 14 | да | 0 |  |
| block2_02_cuped.html | 124 | 15 | 30 | 13 / 13 | да | 0 |  |
| block2_03_srm_diagnostics.html | 181 | 15 | 30 | 13 / 13 | да | 0 |  |
| block2_04_sequential_testing.html | 197 | 15 | 30 | 15 / 15 | да | 0 |  |
| block2_05_switchback.html | 124 | 15 | 30 | 12 / 12 | да | 0 |  |
| block2_06_causal_ml.html | 132 | 15 | 30 | 13 / 13 | да | 0 |  |
| block2_07_feedback_loops.html | 158 | 15 | 30 | 9 / 9 | да | 0 |  |
| block2_08_uplift.html | 202 | 17 | 32 | 5 / 5 | да | 0 |  |
| block2_quiz.html | 17 | 0 | 0 | 0 / 0 |  | 0 |  |
| block3_01_backprop.html | 109 | 9 | 20 | 2 / 2 | да | 0 |  |
| block3_02_optimizers.html | 112 | 10 | 20 | 6 / 6 | да | 0 |  |
| block3_04_attention.html | 190 | 16 | 32 | 5 / 5 | да | 0 |  |
| block3_05_normalization.html | 110 | 9 | 21 | 3 / 3 | да | 0 |  |
| block3_06_ssl.html | 175 | 15 | 30 | 7 / 7 | да | 0 |  |
| block3_07_tabular_dl.html | 123 | 10 | 20 | 4 / 4 | да | 0 |  |
| block3_08_tabpfn.html | 164 | 15 | 30 | 13 / 13 | да | 0 |  |
| block3_quiz.html | 52 | 0 | 0 | 0 / 0 |  | 0 |  |
| block4_01_rfm.html | 175 | 16 | 30 | 7 / 7 | да | 0 |  |
| block4_02_survival.html | 179 | 14 | 30 | 6 / 6 | да | 0 |  |
| block4_03_churn_prediction.html | 185 | 16 | 32 | 7 / 7 | да | 0 |  |
| block4_04_uplift_economics.html | 206 | 15 | 30 | 12 / 12 | да | 0 |  |
| block4_05_nbo.html | 172 | 15 | 30 | 8 / 8 | да | 0 |  |
| block4_06_basket_analysis.html | 170 | 15 | 30 | 9 / 9 | да | 0 |  |
| block4_07_attribution_mmm.html | 211 | 15 | 30 | 12 / 12 | да | 0 |  |
| block4_08_behavioral_segmentation.html | 190 | 15 | 30 | 13 / 13 | да | 0 |  |
| block4_09_subscription_b2b.html | 196 | 15 | 30 | 14 / 14 | да | 0 |  |
| block4_10_hierarchical_clv.html | 175 | 15 | 30 | 14 / 14 | да | 0 |  |
| block4_11_ltv_prediction.html | 75 | 0 | 12 | 4 / 4 | да | 0 |  |
| block4_12_churn_survival.html | 178 | 15 | 30 | 8 / 8 | да | 0 |  |
| block4_13_uplift_retention.html | 197 | 15 | 32 | 9 / 9 | да | 0 |  |
| block4_quiz.html | 16 | 0 | 0 | 0 / 0 |  | 0 |  |
| block5_01_time_series_basics.html | 986 | 15 | 20 | 8 / 8 |  | 0 |  |
| block5_02_exponential_smoothing.html | 982 | 15 | 20 | 5 / 5 |  | 0 |  |
| block5_03_arima.html | 1096 | 15 | 20 | 7 / 7 |  | 0 |  |
| block5_04_validation_metrics.html | 856 | 15 | 20 | 5 / 5 |  | 0 |  |
| block5_05_features_boosting.html | 911 | 15 | 20 | 6 / 6 |  | 0 |  |
| block5_06_probabilistic_conformal.html | 1008 | 15 | 20 | 6 / 6 |  | 0 |  |
| block5_07_hierarchy_intermittent.html | 993 | 15 | 20 | 7 / 7 |  | 0 |  |
| block5_08_neural_foundation.html | 880 | 15 | 20 | 6 / 6 |  | 0 |  |
| block6_01_demand_forecasting.html | 854 | 15 | 20 | 5 / 5 |  | 0 |  |
| block6_02_dynamic_pricing.html | 87 | 0 | 12 | 7 / 7 | да | 0 |  |
| block6_03_anomaly.html | 175 | 14 | 30 | 8 / 8 | да | 0 |  |
| block6_04_fraud_detection.html | 74 | 0 | 12 | 5 / 5 | да | 0 |  |
| block6_quiz.html | 16 | 0 | 0 | 0 / 0 |  | 0 |  |
| block7_01_tokenization_embeddings.html | 161 | 15 | 30 | 8 / 8 | да | 0 |  |
| block7_02_search_ranking.html | 162 | 15 | 30 | 8 / 8 | да | 0 |  |
| block7_03_collab_filtering.html | 276 | 15 | 30 | 14 / 14 | да | 0 |  |
| block7_04_two_tower.html | 225 | 15 | 30 | 12 / 12 | да | 0 |  |
| block7_05_cold_start.html | 249 | 15 | 30 | 13 / 13 | да | 0 |  |
| block7_06_graph_ml.html | 228 | 15 | 30 | 12 / 12 | да | 0 |  |
| block7_07_sequential_rec.html | 160 | 15 | 30 | 11 / 11 | да | 0 |  |
| block7_08_generative_retrieval.html | 148 | 15 | 30 | 12 / 12 | да | 0 |  |
| block7_09_system_design.html | 256 | 15 | 30 | 12 / 12 | да | 0 |  |
| block7_quiz.html | 99 | 0 | 0 | 0 / 0 |  | 0 |  |
| block8_01_llm.html | 158 | 15 | 30 | 7 / 7 | да | 0 |  |
| block8_02_scaling.html | 185 | 16 | 30 | 7 / 7 | да | 0 |  |
| block8_03_rope_positions.html | 167 | 15 | 30 | 12 / 12 | да | 0 |  |
| block8_04_attention_inference.html | 172 | 15 | 30 | 14 / 14 | да | 0 |  |
| block8_05_moe.html | 159 | 15 | 30 | 12 / 12 | да | 0 |  |
| block8_06_rag.html | 150 | 15 | 30 | 10 / 10 | да | 0 |  |
| block8_07_finetuning.html | 255 | 15 | 30 | 15 / 15 | да | 0 |  |
| block8_08_agents.html | 240 | 15 | 30 | 13 / 13 | да | 0 |  |
| block8_quiz.html | 17 | 0 | 0 | 0 / 0 |  | 0 |  |
| block9_quiz.html | 16 | 0 | 0 | 0 / 0 |  | 0 |  |
| index_roadmap.html | 76 | 0 | 0 | 0 / 0 |  | 0 |  |
