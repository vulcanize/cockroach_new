import * as React from "react";
import { IInjectedProps } from "react-router";
import { connect } from "react-redux";

import * as protos from "../../js/protos";
import { databaseNameAttr, tableNameAttr } from "../../util/constants";
import { Bytes } from "../../util/format";
import { AdminUIState } from "../../redux/state";
import { setUISetting } from "../../redux/ui";
import { refreshTableDetails, refreshTableStats, generateTableID } from "../../redux/apiReducers";
import { SummaryBar, SummaryItem } from "../../components/summaryBar";

import { TableInfo } from "./data";
import { SortSetting } from "../../components/sortabletable";
import { SortedTable } from "../../components/sortedtable";

type Grant = Proto2TypeScript.cockroach.server.serverpb.TableDetailsResponse.Grant;

// Specialization of generic SortedTable component:
//   https://github.com/Microsoft/TypeScript/issues/3960
//
// The variable name must start with a capital letter or TSX will not recognize
// it as a component.
// tslint:disable-next-line:variable-name
export const GrantsSortedTable = SortedTable as new () => SortedTable<Grant>;

// Constants used to store per-page sort settings in the redux UI store.
const UI_DATABASE_TABLE_GRANTS_SORT_SETTING_KEY = "tableDetails/sort_setting/grants";

/**
 * TableMainData are the data properties which should be passed to the TableMain
 * container.
 */
interface TableMainData {
  tableInfo: TableInfo;
  grantsSortSetting: SortSetting;
}

/**
 * TableMainActions are the action dispatchers which should be passed to the
 * TableMain container.
 */
interface TableMainActions {
  // Refresh the table data
  refreshTableDetails: typeof refreshTableDetails;
  refreshTableStats: typeof refreshTableStats;
  setUISetting: typeof setUISetting;
}

/**
 * TableMainProps is the type of the props object that must be passed to
 * TableMain component.
 */
type TableMainProps = TableMainData & TableMainActions & IInjectedProps;

/**
 * TableMain renders the main content of the databases page, which is primarily a
 * data table of all databases.
 */
class TableMain extends React.Component<TableMainProps, {}> {
  componentWillMount() {
    this.props.refreshTableDetails(new protos.cockroach.server.serverpb.TableDetailsRequest({
      database: this.props.params[databaseNameAttr],
      table: this.props.params[tableNameAttr],
    }));
    this.props.refreshTableStats(new protos.cockroach.server.serverpb.TableStatsRequest({
      database: this.props.params[databaseNameAttr],
      table: this.props.params[tableNameAttr],
    }));
  }

  // Callback when the user elects to change the grant table sort setting.
  changeGrantSortSetting(setting: SortSetting) {
    this.props.setUISetting(UI_DATABASE_TABLE_GRANTS_SORT_SETTING_KEY, setting);
  }

  render() {
    let { tableInfo, grantsSortSetting } = this.props;

    if (tableInfo) {
      return <div className="section databases">
        <div className="database-summary-title">
          { this.props.params[tableNameAttr] }
        </div>
        <div className="content">
          <pre className="create-table">
            {/* TODO (mrtracy): format and highlight create table statement */}
            {tableInfo.createStatement}
          </pre>
          <div className="sql-table">
          <GrantsSortedTable
            data={tableInfo.grants}
            sortSetting={grantsSortSetting}
            onChangeSortSetting={(setting) => this.changeGrantSortSetting(setting) }
            columns={[
              {
                title: "User",
                cell: (grants) => grants.user,
                sort: (grants) => grants.user,
              },
              {
                title: "Grants",
                cell: (grants) => grants.privileges.join(", "),
                sort: (grants) => grants.privileges.join(", "),
              },
            ]}/>
          </div>
        </div>
        <SummaryBar>
          <SummaryItem
            title="Size"
            tooltip="Total disk size of this table."
            value={ tableInfo.size }
            format={ Bytes }/>
          <SummaryItem
            title="Ranges"
            tooltip="The total count of ranges in this database"
            value={ tableInfo.rangeCount }/>
        </SummaryBar>
      </div>;
    }
    return <div>No results.</div>;
  }
}

/******************************
 *         SELECTORS
 */

function tableInfo(state: AdminUIState, props: IInjectedProps): TableInfo {
  let db = props.params[databaseNameAttr];
  let table = props.params[tableNameAttr];
  let details = state.cachedData.tableDetails[generateTableID(db, table)];
  let stats = state.cachedData.tableStats[generateTableID(db, table)];
  return new TableInfo(table, details && details.data, stats && stats.data);
}

function grantsSortSetting(state: AdminUIState): SortSetting {
  return state.ui[UI_DATABASE_TABLE_GRANTS_SORT_SETTING_KEY] || {};
}

// Connect the TableMain class with our redux store.
let tableMainConnected = connect(
  (state: AdminUIState, ownProps: IInjectedProps) => {
    return {
      tableInfo: tableInfo(state, ownProps),
      grantsSortSetting: grantsSortSetting(state),
    };
  },
  {
    setUISetting,
    refreshTableDetails,
    refreshTableStats,
  }
)(TableMain);

export default tableMainConnected;
