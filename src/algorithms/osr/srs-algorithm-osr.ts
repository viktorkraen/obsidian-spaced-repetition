import moment, { Moment } from "moment";

import { ISrsAlgorithm } from "src/algorithms/base/isrs-algorithm";
import { RepItemScheduleInfo } from "src/algorithms/base/rep-item-schedule-info";
import { ReviewResponse } from "src/algorithms/base/repetition-item";
import { osrSchedule } from "src/algorithms/osr/note-scheduling";
import { NoteLinkStat, OsrNoteGraph } from "src/algorithms/osr/osr-note-graph";
import { RepItemScheduleInfoOsr } from "src/algorithms/osr/rep-item-schedule-info-osr";
import { DueDateHistogram } from "src/due-date-histogram";
import { Note } from "src/note";
import { INoteEaseList, NoteEaseList } from "src/note-ease-list";
import { Question } from "src/question";
import { SRSettings } from "src/settings";
import { globalDateProvider } from "src/utils/dates";

export class SrsAlgorithmOsr implements ISrsAlgorithm {
    private settings: SRSettings;
    private noteEaseList: INoteEaseList;

    constructor(settings: SRSettings) {
        this.settings = settings;
        this.noteEaseList = new NoteEaseList(settings);
    }

    static get initialInterval(): number {
        return 1.0;
    }

    noteCalcNewSchedule(
        notePath: string,
        osrNoteGraph: OsrNoteGraph,
        response: ReviewResponse,
        dueDateNoteHistogram: DueDateHistogram,
    ): RepItemScheduleInfo {
        const noteLinkStat: NoteLinkStat = osrNoteGraph.calcNoteLinkStat(
            notePath,
            this.noteEaseList,
        );

        const linkContribution: number =
            this.settings.maxLinkFactor *
            Math.min(1.0, Math.log(noteLinkStat.totalLinkCount + 0.5) / Math.log(64));
        let ease: number =
            (1.0 - linkContribution) * this.settings.baseEase +
            (noteLinkStat.totalLinkCount > 0
                ? (linkContribution * noteLinkStat.linkTotal) / noteLinkStat.linkPGTotal
                : linkContribution * this.settings.baseEase);

        if (this.noteEaseList.hasEaseForPath(notePath)) {
            ease = (ease + this.noteEaseList.getEaseByPath(notePath)) / 2;
        }

        const dueDate: Moment = null;
        const interval: number = SrsAlgorithmOsr.initialInterval;
        ease = Math.round(ease);
        const temp: RepItemScheduleInfoOsr = new RepItemScheduleInfoOsr(dueDate, interval, ease);

        const result: RepItemScheduleInfoOsr = this.calcSchedule(
            temp,
            response,
            dueDateNoteHistogram,
            true
        );

        result.dueDate = moment(globalDateProvider.today).add(result.interval, "days");
        return result;
    }

    noteOnLoadedNote(path: string, note: Note, noteEase: number): void {
        let flashcardsInNoteAvgEase: number = null;
        if (note) {
            flashcardsInNoteAvgEase = SrsAlgorithmOsr.calculateFlashcardAvgEase(
                note.questionList,
                this.settings,
            );
        }
        let ease: number = null;
        if (flashcardsInNoteAvgEase && noteEase) {
            ease = (flashcardsInNoteAvgEase + noteEase) / 2;
        } else {
            ease = flashcardsInNoteAvgEase ? flashcardsInNoteAvgEase : noteEase;
        }

        if (ease) {
            this.noteEaseList.setEaseForPath(path, ease);
        }
    }

    static calculateFlashcardAvgEase(questionList: Question[], settings: SRSettings): number {
        let totalEase: number = 0;
        let scheduledCount: number = 0;

        questionList.forEach((question) => {
            question.cards
                .filter((card) => card.hasSchedule)
                .forEach((card) => {
                    totalEase += card.scheduleInfo.latestEase;
                    scheduledCount++;
                });
        });

        let result: number = 0;
        if (scheduledCount > 0) {
            const flashcardsInNoteAvgEase: number = totalEase / scheduledCount;
            const flashcardContribution: number = Math.min(
                1.0,
                Math.log(scheduledCount + 0.5) / Math.log(64),
            );
            result =
                flashcardsInNoteAvgEase * flashcardContribution +
                settings.baseEase * (1.0 - flashcardContribution);
        }
        return result;
    }

    noteCalcUpdatedSchedule(
        notePath: string,
        noteSchedule: RepItemScheduleInfo,
        response: ReviewResponse,
        dueDateNoteHistogram?: DueDateHistogram,
    ): RepItemScheduleInfo {
        const noteScheduleOsr = noteSchedule as RepItemScheduleInfoOsr;
        const temp = this.calcSchedule(noteScheduleOsr, response, dueDateNoteHistogram, false);
        
        const interval = temp.interval;
        const ease = temp.latestEase;
        
        const dueDate = moment(globalDateProvider.today).add(interval, "days");
        
        this.noteEaseList.setEaseForPath(notePath, ease);
        
        return new RepItemScheduleInfoOsr(dueDate, interval, ease);
    }

    private calcSchedule(
        schedule: RepItemScheduleInfoOsr,
        response: ReviewResponse,
        dueDateHistogram: DueDateHistogram,
        isNewCard: boolean = false,
    ): RepItemScheduleInfoOsr {
        const temp: Record<string, number> = osrSchedule(
            response,
            schedule.interval,
            schedule.latestEase,
            schedule.delayedBeforeReviewTicks,
            this.settings,
            dueDateHistogram,
            isNewCard
        );

        return new RepItemScheduleInfoOsr(
            globalDateProvider.today,
            temp.interval,
            temp.ease
        );
    }

    cardGetResetSchedule(): RepItemScheduleInfo {
        const interval = SrsAlgorithmOsr.initialInterval;
        const ease = this.settings.baseEase;
        const dueDate = globalDateProvider.today.add(interval, "d");
        return new RepItemScheduleInfoOsr(dueDate, interval, ease);
    }

    cardGetNewSchedule(
        response: ReviewResponse,
        notePath: string,
        dueDateFlashcardHistogram: DueDateHistogram,
    ): RepItemScheduleInfo {
        let initialEase: number = this.settings.baseEase;
        if (this.noteEaseList.hasEaseForPath(notePath)) {
            initialEase = Math.round(this.noteEaseList.getEaseByPath(notePath));
        }
        const delayBeforeReview = 0;

        const schedObj: Record<string, number> = osrSchedule(
            response,
            SrsAlgorithmOsr.initialInterval,
            initialEase,
            delayBeforeReview,
            this.settings,
            dueDateFlashcardHistogram,
            true
        );

        const interval = schedObj.interval;
        const ease = schedObj.ease;
        const dueDate = response === ReviewResponse.Hard ? null : globalDateProvider.today.add(interval, "d");
        return new RepItemScheduleInfoOsr(dueDate, interval, ease, delayBeforeReview);
    }

    cardCalcUpdatedSchedule(
        response: ReviewResponse,
        cardSchedule: RepItemScheduleInfo,
        dueDateFlashcardHistogram: DueDateHistogram,
    ): RepItemScheduleInfo {
        const cardScheduleOsr: RepItemScheduleInfoOsr = cardSchedule as RepItemScheduleInfoOsr;
        const schedObj: Record<string, number> = osrSchedule(
            response,
            cardScheduleOsr.interval,
            cardSchedule.latestEase,
            cardSchedule.delayedBeforeReviewTicks,
            this.settings,
            dueDateFlashcardHistogram,
            false
        );
        const interval = schedObj.interval;
        const ease = schedObj.ease;
        
        const dueDate = response === ReviewResponse.Hard 
            ? cardSchedule.dueDate 
            : moment(globalDateProvider.today).add(interval, "days");
        
        const delayBeforeReview = 0;
        return new RepItemScheduleInfoOsr(dueDate, interval, ease, delayBeforeReview);
    }

    noteStats() {
        return this.noteEaseList;
    }
}
