import { createPmMyItemsPro } from './PmMyItemsProShell.jsx'
import { TASKS_ENTITY } from './lib/pmMyItemsEntities.js'

/**
 * My Items / My Tasks for Kissflow Process: Project_Sub_Task_A01
 * New Task → create draft, then open Popup_bEJJgrdutd with InstanceID + ActivityInstanceID
 */
const TasksMyItemsPro = createPmMyItemsPro(TASKS_ENTITY)

export default TasksMyItemsPro
