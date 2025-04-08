// eslint-disable-next-line @typescript-eslint/no-unused-vars
import h from "vhtml";
import moment from "moment";

import { COLLAPSE_ICON } from "src/constants";
import { Deck } from "src/deck";
import {
    DeckStats,
    IFlashcardReviewSequencer as IFlashcardReviewSequencer,
} from "src/flashcard-review-sequencer";
import { FlashcardMode } from "src/gui/sr-modal";
import { t } from "src/lang/helpers";
import type SRPlugin from "src/main";
import { SRSettings } from "src/settings";
import { TopicPath } from "src/topic-path";
import { globalDateProvider, SimulatedDateProvider } from "src/utils/dates";

export class DeckUI {
    public plugin: SRPlugin;
    public mode: FlashcardMode;
    public contentEl: HTMLElement;

    public view: HTMLDivElement;
    public header: HTMLDivElement;
    public title: HTMLDivElement;
    public stats: HTMLDivElement;
    public content: HTMLDivElement;

    private reviewSequencer: IFlashcardReviewSequencer;
    private settings: SRSettings;
    private startReviewOfDeck: (deck: Deck) => void;

    constructor(
        plugin: SRPlugin,
        settings: SRSettings,
        reviewSequencer: IFlashcardReviewSequencer,
        contentEl: HTMLElement,
        startReviewOfDeck: (deck: Deck) => void,
    ) {
        // Init properties
        this.plugin = plugin;
        this.settings = settings;
        this.reviewSequencer = reviewSequencer;
        this.contentEl = contentEl;
        this.startReviewOfDeck = startReviewOfDeck;

        // Build ui
        this.init();
    }

    /**
     * Initializes all static elements in the DeckListView
     */
    init(): void {
        this.view = this.contentEl.createDiv();
        this.view.addClasses(["sr-deck-list", "sr-is-hidden"]);

        this.header = this.view.createDiv();
        this.header.addClass("sr-header");

        this.title = this.header.createDiv();
        this.title.addClass("sr-title");
        this.title.setText(t("DECKS"));

        this.stats = this.header.createDiv();
        this.stats.addClass("sr-header-stats-container");
        this._createHeaderStats();

        this.content = this.view.createDiv();
        this.content.addClass("sr-content");
    }

    /**
     * Shows the DeckListView & rerenders dynamic elements
     */
    async show(): Promise<void> {
        this.mode = FlashcardMode.Deck;

        // Скидаємо дату до поточної тільки при першому показі
        (globalDateProvider as SimulatedDateProvider).setSimulatedDate(null);
        await this.reviewSequencer.reloadCardsForDate(moment());
        
        await this.updateDisplay();
    }

    /**
     * Updates the display without resetting the date
     */
    private async updateDisplay(): Promise<void> {
        // Redraw in case the stats have changed
        this._createHeaderStats();

        this.content.empty();
        for (const deck of this.reviewSequencer.originalDeckTree.subdecks) {
            this._createTree(deck, this.content);
        }

        if (this.view.hasClass("sr-is-hidden")) {
            this.view.removeClass("sr-is-hidden");
        }
    }

    /**
     * Hides the DeckListView
     */
    hide() {
        if (!this.view.hasClass("sr-is-hidden")) {
            this.view.addClass("sr-is-hidden");
        }
    }

    /**
     * Closes the DeckListView
     */
    close() {
        this.hide();
    }

    // -> Header

    private _createHeaderStats() {
        const statistics: DeckStats = this.reviewSequencer.getDeckStats(TopicPath.emptyPath);
        this.stats.empty();

        // Add date simulation component
        const dateSimContainer = this.stats.createDiv();
        dateSimContainer.addClass("sr-date-sim-container");
        
        const dateInput = dateSimContainer.createEl("input");
        dateInput.type = "date";
        // Встановлюємо значення на основі поточної симульованої дати
        dateInput.value = (globalDateProvider as SimulatedDateProvider).today.format("YYYY-MM-DD");
        dateInput.addClass("sr-date-sim-input");
        
        const resetButton = dateSimContainer.createEl("button");
        resetButton.setText("Refresh 🔄");
        resetButton.addClass("sr-date-sim-reset");
        
        // Add event listeners
        dateInput.addEventListener("change", async (e) => {
            const target = e.target as HTMLInputElement;
            const date = moment(target.value, "YYYY-MM-DD");
            if (date.isValid()) {
                (globalDateProvider as SimulatedDateProvider).setSimulatedDate(date);
                // Оновлюємо дані після зміни дати
                await this.reviewSequencer.reloadCardsForDate(date);
                // Оновлюємо відображення колод без скидання дати
                await this.updateDisplay();
            }
        });
        
        resetButton.addEventListener("click", async () => {
            (globalDateProvider as SimulatedDateProvider).setSimulatedDate(null);
            dateInput.value = moment().format("YYYY-MM-DD");
            // Оновлюємо дані після скидання дати
            await this.reviewSequencer.reloadCardsForDate(moment());
            // Оновлюємо відображення колод без скидання дати
            await this.updateDisplay();
        });

        // Add end hour component below stats
        const endHourContainer = this.stats.createDiv();
        endHourContainer.addClass("sr-end-hour-container");
        
        const endHourLabel = endHourContainer.createEl("span");
        endHourLabel.setText(t("END_HOUR") + ": ");
        endHourLabel.addClass("sr-end-hour-label");
        
        const endHourSelect = endHourContainer.createEl("select");
        endHourSelect.addClass("sr-end-hour-select");
        for (let hour = 0; hour <= 23; hour++) {
            const option = endHourSelect.createEl("option");
            option.value = hour.toString();
            option.text = hour.toString().padStart(2, "0") + ":00";
            if (hour === this.plugin.data.settings.reviewEndHour) {
                option.selected = true;
            }
        }

        endHourSelect.addEventListener("change", (e) => {
            const value = parseInt((e.target as HTMLSelectElement).value);
            if (!isNaN(value) && value >= 0 && value <= 23) {
                this.plugin.data.settings.reviewEndHour = value;
                this.plugin.savePluginData();
                updateCardsPerHour();
            }
        });

        const cardsPerHourContainer = endHourContainer.createDiv();
        cardsPerHourContainer.addClass("sr-cards-per-hour-container");

        const cardsPerHourValue = cardsPerHourContainer.createEl("span");
        cardsPerHourValue.className = "sr-cards-per-hour-value";

        const cardsPerHourLabel = cardsPerHourContainer.createEl("span");
        cardsPerHourLabel.className = "sr-cards-per-hour-label";
        cardsPerHourLabel.innerText = "per hour";

        const updateCardsPerHour = () => {
            const nowHour = new Date().getHours();
            const totalCards = statistics.dueCount + statistics.newCount;
            const endHour = this.plugin.data.settings.reviewEndHour;
            let hoursLeft;
            if (endHour > nowHour) {
                hoursLeft = endHour - nowHour;
            } else {
                hoursLeft = (24 - nowHour) + endHour;
            }
            if (hoursLeft <= 0) hoursLeft = 1;

            if (
                this.plugin.data.settings.lastHour === undefined ||
                this.plugin.data.settings.lastTotalCards === undefined ||
                this.plugin.data.settings.cardsQuotaPerHour === undefined ||
                this.plugin.data.settings.cardsQuotaPerHour.length !== hoursLeft ||
                this.plugin.data.settings.lastHour !== nowHour
            ) {
                // новий період або перший запуск
                const baseQuota = Math.ceil(totalCards / hoursLeft);
                this.plugin.data.settings.cardsQuotaPerHour = Array(hoursLeft).fill(baseQuota);
                this.plugin.data.settings.lastHour = nowHour;
                this.plugin.data.settings.lastTotalCards = totalCards;
                this.plugin.savePluginData();
            } else if (totalCards > this.plugin.data.settings.lastTotalCards) {
                // додано нові картки, розподіляємо їх
                const newCards = totalCards - this.plugin.data.settings.lastTotalCards;
                const addPerHour = Math.floor(newCards / hoursLeft);
                let remainder = newCards % hoursLeft;
                for (let i = 0; i < hoursLeft; i++) {
                    this.plugin.data.settings.cardsQuotaPerHour[i] += addPerHour;
                    if (remainder > 0) {
                        this.plugin.data.settings.cardsQuotaPerHour[i]++;
                        remainder--;
                    }
                }
                this.plugin.data.settings.lastTotalCards = totalCards;
                this.plugin.savePluginData();
            }

            // Відображаємо квоту для поточної години (перша в масиві)
            cardsPerHourValue.innerText = this.plugin.data.settings.cardsQuotaPerHour[0].toString();
        };

        updateCardsPerHour();

        this._createHeaderStatsContainer(t("DUE_CARDS"), statistics.dueCount, "sr-bg-green");
        this._createHeaderStatsContainer(t("NEW_CARDS"), statistics.newCount, "sr-bg-blue");
        this._createHeaderStatsContainer(t("TOTAL_CARDS"), statistics.totalCount, "sr-bg-red");
    }

    private _createHeaderStatsContainer(
        statsLable: string,
        statsNumber: number,
        statsClass: string,
    ): void {
        const statsContainer = this.stats.createDiv();
        statsContainer.ariaLabel = statsLable;
        statsContainer.addClasses([
            "tag-pane-tag-count",
            "tree-item-flair",
            "sr-header-stats-count",
            statsClass,
        ]);

        const lable = statsContainer.createDiv();
        lable.setText(statsLable + ":");

        const number = statsContainer.createDiv();
        number.setText(statsNumber.toString());
    }

    // -> Tree content

    private _createTree(deck: Deck, container: HTMLElement): void {
        const deckTree: HTMLElement = container.createDiv("tree-item sr-tree-item-container");
        const deckTreeSelf: HTMLElement = deckTree.createDiv(
            "tree-item-self tag-pane-tag is-clickable sr-tree-item-row",
        );

        const shouldBeInitiallyExpanded: boolean = this.settings.initiallyExpandAllSubdecksInTree;
        let collapsed = !shouldBeInitiallyExpanded;
        let collapseIconEl: HTMLElement | null = null;
        if (deck.subdecks.length > 0) {
            collapseIconEl = deckTreeSelf.createDiv("tree-item-icon collapse-icon");
            collapseIconEl.innerHTML = COLLAPSE_ICON;
            (collapseIconEl.childNodes[0] as HTMLElement).style.transform = collapsed
                ? "rotate(-90deg)"
                : "";
        }

        const deckTreeInner: HTMLElement = deckTreeSelf.createDiv("tree-item-inner");
        const deckTreeInnerText: HTMLElement = deckTreeInner.createDiv("tag-pane-tag-text");
        deckTreeInnerText.innerHTML += <span class="tag-pane-tag-self">{deck.deckName}</span>;

        const deckTreeOuter: HTMLDivElement = deckTreeSelf.createDiv();
        deckTreeOuter.addClasses(["tree-item-flair-outer", "sr-tree-stats-container"]);

        const deckStats = this.reviewSequencer.getDeckStats(deck.getTopicPath());
        this._createStats(deckStats, deckTreeOuter);

        const deckTreeChildren: HTMLElement = deckTree.createDiv("tree-item-children");
        deckTreeChildren.style.display = collapsed ? "none" : "block";
        if (deck.subdecks.length > 0) {
            collapseIconEl.addEventListener("click", (e) => {
                if (collapsed) {
                    (collapseIconEl.childNodes[0] as HTMLElement).style.transform = "";
                    deckTreeChildren.style.display = "block";
                } else {
                    (collapseIconEl.childNodes[0] as HTMLElement).style.transform =
                        "rotate(-90deg)";
                    deckTreeChildren.style.display = "none";
                }

                // We stop the propagation of the event so that the click event for deckTreeSelf doesn't get called
                // if the user clicks on the collapse icon
                e.stopPropagation();
                collapsed = !collapsed;
            });
        }

        // Add the click handler to deckTreeSelf instead of deckTreeInner so that it activates
        // over the entire rectangle of the tree item, not just the text of the topic name
        // https://github.com/st3v3nmw/obsidian-spaced-repetition/issues/709
        deckTreeSelf.addEventListener("click", () => {
            this.startReviewOfDeck(deck);
        });

        for (const subdeck of deck.subdecks) {
            this._createTree(subdeck, deckTreeChildren);
        }
    }

    private _createStats(statistics: DeckStats, statsWrapper: HTMLDivElement) {
        statsWrapper.empty();

        this._createStatsContainer(
            t("DUE_CARDS"),
            statistics.dueCount,
            "sr-bg-green",
            statsWrapper,
        );
        this._createStatsContainer(t("NEW_CARDS"), statistics.newCount, "sr-bg-blue", statsWrapper);
        this._createStatsContainer(
            t("TOTAL_CARDS"),
            statistics.totalCount,
            "sr-bg-red",
            statsWrapper,
        );
    }

    private _createStatsContainer(
        statsLable: string,
        statsNumber: number,
        statsClass: string,
        statsWrapper: HTMLDivElement,
    ): void {
        const statsContainer = statsWrapper.createDiv();

        statsContainer.ariaLabel = statsLable;

        statsContainer.addClasses([
            "tag-pane-tag-count",
            "tree-item-flair",
            "sr-tree-stats-count",
            statsClass,
        ]);

        statsContainer.setText(statsNumber.toString());
    }
}
