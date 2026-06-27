"""Positive-class metrics and the old-vs-new comparison report."""

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_recall_fscore_support,
)


def positive_class_metrics(y_true, proba, threshold: float) -> dict:
    """Metrics for the positive ('risky') class at a given decision threshold."""
    y_pred = (np.asarray(proba) >= threshold).astype(int)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=[1], average="binary", zero_division=0
    )
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    return {
        "threshold": round(float(threshold), 3),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "pr_auc": round(float(average_precision_score(y_true, proba)), 4),
        "confusion_matrix": cm.tolist(),  # [[TN, FP], [FN, TP]]
        "support_pos": int((np.asarray(y_true) == 1).sum()),
        "support_total": int(len(y_true)),
    }


def _fmt_cm(cm) -> str:
    (tn, fp), (fn, tp) = cm
    return (
        f"|            | pred 0 | pred 1 |\n"
        f"|------------|-------:|-------:|\n"
        f"| **true 0** | {tn} | {fp} |\n"
        f"| **true 1** | {fn} | {tp} |"
    )


_OLD_LABEL = "RF — RandomForest (raw-price features, vol-regime label)"
_NEW_LABEL = "XGB — XGBoost (scale-free features, vol-regime label)"


def render_comparison(
    old: dict,
    new: dict,
    extra: dict | None = None,
    old_label: str = _OLD_LABEL,
    new_label: str = _NEW_LABEL,
    label_description: str = (
        "positive = forward-10d realized vol in top tercile of that ticker's "
        "own 252-day trailing distribution"
    ),
) -> str:
    """Build the markdown comparison report (positive class)."""
    lines = []
    lines.append("# Vol-regime model — comparison on the SAME time-based test set\n")
    lines.append(
        f"All metrics are for the **positive class** ({label_description}), "
        "evaluated on the most-recent ~15% of trading dates that neither model "
        "was trained on. Accuracy is omitted as the class is ~33% positive by "
        "construction.\n"
    )

    lines.append("## Headline metrics (positive class)\n")
    lines.append(f"| metric | {old_label} | {new_label} |")
    lines.append(f"|--------|{'-'*(len(old_label)+2)}:|{'-'*(len(new_label)+2)}:|")
    lines.append(f"| decision threshold | {old['threshold']} | {new['threshold']} |")
    lines.append(f"| precision | {old['precision']} | {new['precision']} |")
    lines.append(f"| recall | {old['recall']} | {new['recall']} |")
    lines.append(f"| F1 | {old['f1']} | {new['f1']} |")
    lines.append(f"| PR-AUC | {old['pr_auc']} | {new['pr_auc']} |")
    lines.append("")
    lines.append(
        f"Test set: {new['support_total']} samples, "
        f"{new['support_pos']} positive "
        f"({100 * new['support_pos'] / max(new['support_total'], 1):.1f}%).\n"
    )

    lines.append("## Confusion matrices\n")
    lines.append(f"**{old_label}**\n")
    lines.append(_fmt_cm(old["confusion_matrix"]))
    lines.append(f"\n**{new_label}**\n")
    lines.append(_fmt_cm(new["confusion_matrix"]))
    lines.append("")

    if extra:
        lines.append("## Notes\n")
        for k, v in extra.items():
            lines.append(f"- **{k}:** {v}")
        lines.append("")

    return "\n".join(lines)
