import { ReviewResponse } from "src/algorithms/base/repetition-item";
import { TICKS_PER_DAY } from "src/constants";
import { DueDateHistogram } from "src/due-date-histogram";
import { t } from "src/lang/helpers";
import { SRSettings } from "src/settings";

// Note that if dueDateHistogram is provided, then it is just used to assist with fuzzing.
// (Unlike earlier versions, it is not updated based on the calculated schedule. The
// caller needs to do that if needed.

export function osrSchedule(
    response: ReviewResponse,
    originalInterval: number,
    ease: number,
    delayedBeforeReview: number,
    settings: SRSettings,
    dueDateHistogram?: DueDateHistogram,
    isNewCard: boolean = false,
): Record<string, number> {
    const delayedBeforeReviewDays = Math.max(0, Math.floor(delayedBeforeReview / TICKS_PER_DAY));
    let interval: number = originalInterval;

    if (response === ReviewResponse.Easy) {
        // Збільшуємо ease на 20
        ease += 20;
        // Розраховуємо новий інтервал
        interval = Math.max(1, Math.round(((interval + delayedBeforeReviewDays) * ease) / 100));
        // Застосовуємо бонус за легку відповідь
        interval = Math.round(interval * settings.easyBonus);
    } else if (response === ReviewResponse.Good) {
        if (isNewCard) {
            // Для нових карток встановлюємо інтервал 2 дні при натисканні Good
            interval = 2;
        } else {
            interval = ((interval + delayedBeforeReviewDays / 2) * ease) / 100;
        }
    } else if (response === ReviewResponse.Hard) {
        // Зменшуємо ease на 20% (але не менше 130)
        ease = Math.max(130, ease - 20);
        // Зменшуємо інтервал на 50% при кожному натисканні
        interval = Math.max(1, Math.round(originalInterval * 0.5));
    }

    // replaces random fuzz with load balancing over the fuzz interval
    if (settings.loadBalance && dueDateHistogram !== undefined && !(isNewCard && response === ReviewResponse.Good)) {
        interval = Math.round(interval);
        // disable fuzzing for small intervals
        if (interval > 7) {
            let fuzz: number;
            // 3 day window: day - 1 <= x <= day + 1
            if (interval <= 21) fuzz = 1;
            // up to a week window: day - 3 <= x <= day + 3
            else if (interval <= 180) fuzz = Math.min(3, Math.floor(interval * 0.05));
            // up to a 2 weeks window: day - 7 <= x <= day + 7
            else fuzz = Math.min(7, Math.floor(interval * 0.025));

            interval = dueDateHistogram.findLeastUsedIntervalOverRange(interval, fuzz);
        }
    }

    // Не застосовуємо обмеження максимального інтервалу для нових карток з кнопкою Good
    if (!(isNewCard && response === ReviewResponse.Good)) {
        interval = Math.min(interval, settings.maximumInterval);
    }
    
    // Не застосовуємо округлення для нових карток з кнопкою Good
    if (!(isNewCard && response === ReviewResponse.Good)) {
        interval = Math.round(interval * 10) / 10;
    }

    return { interval, ease };
}

export function textInterval(interval: number, isMobile: boolean): string {
    if (interval === undefined) {
        return t("NEW");
    }

    const m: number = Math.round(interval / 3.04375) / 10,
        y: number = Math.round(interval / 36.525) / 10;

    if (isMobile) {
        if (m < 1.0) return t("DAYS_STR_IVL_MOBILE", { interval });
        else if (y < 1.0) return t("MONTHS_STR_IVL_MOBILE", { interval: m });
        else return t("YEARS_STR_IVL_MOBILE", { interval: y });
    } else {
        if (m < 1.0) return t("DAYS_STR_IVL", { interval });
        else if (y < 1.0) return t("MONTHS_STR_IVL", { interval: m });
        else return t("YEARS_STR_IVL", { interval: y });
    }
}
