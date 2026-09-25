import { createPmMyItemsPro } from './PmMyItemsProShell.jsx'
import { SUBTASKS_ENTITY } from './lib/pmMyItemsEntities.js'

/**
 * My Items / My Tasks for Kissflow Process: Sub_Task_Process_A00
 * New Subtask → create draft, then open Popup_QTJQAyhxOR with InstanceID + ActivityInstanceID
 */
const SubtasksMyItemsPro = createPmMyItemsPro(SUBTASKS_ENTITY)

export default SubtasksMyItemsPro
