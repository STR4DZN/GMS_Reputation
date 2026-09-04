import { DATA_SCHEMA_VERSION, MODULE_VERSION } from "../constants.js";
import * as Schema from "../data/schema.js";
import * as Score from "../core/score.js";
import * as ReputationEngine from "../core/reputation-engine.js";
import * as SemanticBands from "../core/semantic-bands.js";
import * as Bond from "../core/bond.js";
import * as Communion from "../core/communion.js";
import * as DualSync from "../core/dual-sync.js";
import * as SpecialPresentation from "../core/special-presentation.js";
import * as HeartTrack from "../components/heart-track.js";
import * as Portrait from "../core/portrait.js";
import * as PortraitFrame from "../components/portrait-frame.js";
import * as PortraitEditor from "../components/portrait-editor.js";
import * as Identity from "../components/identity.js";
import * as QuickRead from "../core/quick-read.js";
import * as PlayerCard from "../components/player-card.js";
import * as FocalProfile from "../components/focal-profile.js";
import * as SubjectDetail from "../apps/subject-detail.js";
import * as PlayerDashboard from "../apps/player-dashboard.js";
import * as MasterPanel from "../apps/master-panel.js";
import * as PortraitRegistry from "../data/portrait-registry.js";
import * as Profiles from "../data/profile-registry.js";
import * as FilePickerAdapter from "../utils/file-picker.js";
import * as Subjects from "../data/subject-registry.js";
import * as Groups from "../data/group-registry.js";
import * as Reputation from "../data/reputation-registry.js";
import * as History from "../data/history-registry.js";
import * as BulkOperations from "../data/bulk-operations.js";
import * as UndoRedo from "../data/undo-redo.js";
import * as MasterPreferences from "../persistence/master-preferences.js";
import * as MasterSaveController from "../apps/master/save-controller.js";
import * as Permissions from "../persistence/permissions.js";
import * as AuthorityBroker from "../persistence/authority-broker.js";
import * as WorldSync from "../events/world-sync.js";
import * as SystemAudit from "../audit/system-audit.js";
import * as VisualContract from "../audit/visual-contract.js";
import * as SceneControls from "../ui/scene-controls.js";
import * as Store from "../persistence/world-store.js";
import * as Migration from "../migration/legacy-migration.js";

/**
 * Exact 59.10 API facade. Keeping this in compatibility/ lets internals move
 * without breaking macros or external consumers of game.modules.get(...).api.
 */
export function createLegacyPublicApi() {
  return Object.freeze({
    version: MODULE_VERSION,
    schemaVersion: DATA_SCHEMA_VERSION,
    schema: Object.freeze({ ...Schema }),
    score: Object.freeze({ ...Score }),
    reputationEngine: Object.freeze({ ...ReputationEngine }),
    semanticBands: Object.freeze({ ...SemanticBands }),
    bond: Object.freeze({ ...Bond }),
    communion: Object.freeze({ ...Communion }),
    dualSync: Object.freeze({ ...DualSync }),
    specialPresentation: Object.freeze({ ...SpecialPresentation }),
    heartTrack: Object.freeze({ ...HeartTrack }),
    portrait: Object.freeze({ ...Portrait }),
    portraitFrame: Object.freeze({ ...PortraitFrame }),
    portraitEditor: Object.freeze({ ...PortraitEditor }),
    identity: Object.freeze({ ...Identity }),
    quickRead: Object.freeze({ ...QuickRead }),
    playerCard: Object.freeze({ ...PlayerCard }),
    focalProfile: Object.freeze({ ...FocalProfile }),
    subjectDetail: Object.freeze({ ...SubjectDetail }),
    playerDashboard: Object.freeze({ ...PlayerDashboard }),
    masterPanel: Object.freeze({ ...MasterPanel }),
    portraits: Object.freeze({ ...PortraitRegistry }),
    profiles: Object.freeze({ ...Profiles }),
    filePicker: Object.freeze({ ...FilePickerAdapter }),
    store: Object.freeze({ ...Store }),
    migration: Object.freeze({ ...Migration }),
    subjects: Object.freeze({ ...Subjects }),
    groups: Object.freeze({ ...Groups }),
    reputation: Object.freeze({ ...Reputation }),
    history: Object.freeze({ ...History }),
    bulkOperations: Object.freeze({ ...BulkOperations }),
    undoRedo: Object.freeze({ ...UndoRedo }),
    masterPreferences: Object.freeze({ ...MasterPreferences }),
    masterSaveController: Object.freeze({ ...MasterSaveController }),
    permissions: Object.freeze({ ...Permissions }),
    authorityBroker: Object.freeze({ ...AuthorityBroker }),
    worldSync: Object.freeze({ ...WorldSync }),
    systemAudit: Object.freeze({ ...SystemAudit }),
    visualContract: Object.freeze({ ...VisualContract }),
    sceneControls: Object.freeze({ ...SceneControls })
  });
}
