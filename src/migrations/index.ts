import * as migration_20261030_175325_initial from './20261030_175325_initial';
import * as migration_20261030_181307_settings_change_log from './20261030_181307_settings_change_log';
import * as migration_20261031_155210_reimbursement_multi_receipt from './20261031_155210_reimbursement_multi_receipt';
import * as migration_20261101_035530_expense_categories_setting from './20261101_035530_expense_categories_setting';
import * as migration_20261102_083513_expense_detail_merged from './20261102_083513_expense_detail_merged';
import * as migration_20261103_161500_expense_categories_single_level from './20261103_161500_expense_categories_single_level';
import * as migration_20261103_174500_reimbursement_reviewer_snapshot from './20261103_174500_reimbursement_reviewer_snapshot';
import * as migration_20261105_013050_drop_unused_toolkits_opportunities from './20261105_013050_drop_unused_toolkits_opportunities';

export const migrations = [
  {
    up: migration_20261030_175325_initial.up,
    down: migration_20261030_175325_initial.down,
    name: '20261030_175325_initial',
  },
  {
    up: migration_20261030_181307_settings_change_log.up,
    down: migration_20261030_181307_settings_change_log.down,
    name: '20261030_181307_settings_change_log',
  },
  {
    up: migration_20261031_155210_reimbursement_multi_receipt.up,
    down: migration_20261031_155210_reimbursement_multi_receipt.down,
    name: '20261031_155210_reimbursement_multi_receipt',
  },
  {
    up: migration_20261101_035530_expense_categories_setting.up,
    down: migration_20261101_035530_expense_categories_setting.down,
    name: '20261101_035530_expense_categories_setting',
  },
  {
    up: migration_20261102_083513_expense_detail_merged.up,
    down: migration_20261102_083513_expense_detail_merged.down,
    name: '20261102_083513_expense_detail_merged',
  },
  {
    up: migration_20261103_161500_expense_categories_single_level.up,
    down: migration_20261103_161500_expense_categories_single_level.down,
    name: '20261103_161500_expense_categories_single_level',
  },
  {
    up: migration_20261103_174500_reimbursement_reviewer_snapshot.up,
    down: migration_20261103_174500_reimbursement_reviewer_snapshot.down,
    name: '20261103_174500_reimbursement_reviewer_snapshot',
  },
  {
    up: migration_20261105_013050_drop_unused_toolkits_opportunities.up,
    down: migration_20261105_013050_drop_unused_toolkits_opportunities.down,
    name: '20261105_013050_drop_unused_toolkits_opportunities'
  },
];
