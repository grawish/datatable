import HyperList from 'hyperlist';

export default class BodyRenderer {
    constructor(instance) {
        this.instance = instance;
        this.options = instance.options;
        this.datamanager = instance.datamanager;
        this.rowmanager = instance.rowmanager;
        this.cellmanager = instance.cellmanager;
        this.frozenBodyScrollable = instance.frozenBodyScrollable;
        this.bodyScrollable = instance.bodyScrollable;
        this.footer = this.instance.footer;
        this.log = instance.log;
    }

    renderFrozenRows(rows) {
        const hiddenColIndices = [];
        const cols = this.datamanager.getAllColumns();
        cols.forEach((col, index) => {
            if (!col.freeze) hiddenColIndices.push(index);
        });
        this.visibleRows = rows;
        this.visibleRowIndices = rows.map(row => row.meta.rowIndex);

        if (rows.length === 0) {
            this.frozenBodyScrollable.innerHTML = this.getNoDataHTML();
            return;
        }

        // Create a temporary set for faster lookups.
        // We can't change this.visibleRowIndices as it would be breaking for users.
        let visibleRowIndicesSet = new Set(this.visibleRowIndices);
        const rowViewOrder = this.datamanager.rowViewOrder.map(index => {
            if (visibleRowIndicesSet.has(index)) {
                return index;
            }
            return null;
        }).filter(index => index !== null);

        // const height = this.frozenBodyScrollable.getBoundingClientRect().height;
        // console.log(rows);
        this.frozenBodyScrollable.innerHTML = '';
        for (let i in rows) {
            this.frozenBodyScrollable.appendChild(((index) => {
                const el = document.createElement('div');
                const rowIndex = rowViewOrder[index];
                const row = this.datamanager.getRow(rowIndex);
                const rowWithoutHiddenCols = row.filter((col, i) => !hiddenColIndices.includes(i));
                const rowHTML = this.rowmanager.getRowHTML(rowWithoutHiddenCols, row.meta);
                el.innerHTML = rowHTML;
                return el.children[0];
            })(i));
        }
        // let config = {
        //     width: 'auto',
        //     height: height,
        //     itemHeight: this.options.cellHeight,
        //     total: rows.length,
        //     generate: (index) => {
        //         const el = document.createElement('div');
        //         const rowIndex = rowViewOrder[index];
        //         const row = this.datamanager.getRow(rowIndex);
        //         const rowWithoutHiddenCols = row.filter((col, i) => !hiddenColIndices.includes(i));
        //         const rowHTML = this.rowmanager.getRowHTML(rowWithoutHiddenCols, row.meta);
        //         el.innerHTML = rowHTML;
        //         return el.children[0];
        //     },
        //     afterRender: () => {
        //         this.restoreState();
        //     }
        // };
        //
        // if (!this.hyperlist) {
        //     this.hyperlist = new HyperList(this.frozenBodyScrollable, config);
        // } else {
        //     this.hyperlist.refresh(this.frozenBodyScrollable, config);
        // }

        this.renderFooter();
    }

    renderRows(rows) {
        const hiddenColIndices = [];
        const cols = this.datamanager.getAllColumns();
        cols.forEach((col, index) => {
            if (col.freeze) hiddenColIndices.push(index);
        });
        this.visibleRows = rows;
        this.visibleRowIndices = rows.map(row => row.meta.rowIndex);

        if (rows.length === 0) {
            this.bodyScrollable.innerHTML = this.getNoDataHTML();
            return;
        }

        // Create a temporary set for faster lookups.
        // We can't change this.visibleRowIndices as it would be breaking for users.
        let visibleRowIndicesSet = new Set(this.visibleRowIndices);
        const rowViewOrder = this.datamanager.rowViewOrder.map(index => {
            if (visibleRowIndicesSet.has(index)) {
                return index;
            }
            return null;
        }).filter(index => index !== null);

        const height = this.bodyScrollable.getBoundingClientRect().height;

        let config = {
            width: 'auto',
            height: height,
            itemHeight: this.options.cellHeight + 2,
            total: rows.length,
            generate: (index) => {
                const el = document.createElement('div');
                const rowIndex = rowViewOrder[index];
                const row = this.datamanager.getRow(rowIndex);
                const rowWithoutHiddenCols = row.filter((col, i) => !hiddenColIndices.includes(i));
                const rowHTML = this.rowmanager.getRowHTML(rowWithoutHiddenCols, row.meta);
                el.innerHTML = rowHTML;
                return el.children[0];
            },
            afterRender: () => {
                this.restoreState();
            }
        };

        if (!this.hyperlist) {
            this.hyperlist = new HyperList(this.bodyScrollable, config);
        } else {
            this.hyperlist.refresh(this.bodyScrollable, config);
        }

        this.renderFooter();
    }

    render() {
        const rows = this.datamanager.getRowsForView();
        this.renderFrozenRows(rows);
        this.renderRows(rows);
        // setDimensions requires atleast 1 row to exist in dom
        this.instance.setDimensions();
    }

    renderFooter() {
        if (!this.options.showTotalRow) return;

        const totalRow = this.getTotalRow();
        let html = this.rowmanager.getRowHTML(totalRow, {isTotalRow: 1, rowIndex: 'totalRow'});

        this.footer.innerHTML = html;
    }

    getTotalRow() {
        const columns = this.datamanager.getColumns();
        const totalRowTemplate = columns.map(col => {
            let content = null;
            if (['_rowIndex', '_checkbox'].includes(col.id)) {
                content = '';
            }
            return {
                content,
                isTotalRow: 1,
                colIndex: col.colIndex,
                column: col
            };
        });

        const totalRow = totalRowTemplate.map((cell, i) => {
            if (cell.content === '') return cell;

            if (this.options.hooks.columnTotal) {
                const columnValues = this.visibleRows.map(row => row[i].content);
                const result = this.options.hooks.columnTotal.call(this.instance, columnValues, cell);
                if (result != null) {
                    cell.content = result;
                    return cell;
                }
            }

            cell.content = this.visibleRows.reduce((acc, prevRow) => {
                const prevCell = prevRow[i];
                if (typeof prevCell.content === 'number') {
                    if (acc == null) acc = 0;
                    return acc + prevCell.content;
                }
                return acc;
            }, cell.content);

            return cell;
        });

        return totalRow;
    }

    restoreState() {
        this.rowmanager.highlightCheckedRows();
        this.cellmanager.selectAreaOnClusterChanged();
        this.cellmanager.focusCellOnClusterChanged();
    }

    showToastMessage(message, hideAfter) {
        this.instance.toastMessage.innerHTML = this.getToastMessageHTML(message);

        if (hideAfter) {
            setTimeout(() => {
                this.clearToastMessage();
            }, hideAfter * 1000);
        }
    }

    clearToastMessage() {
        this.instance.toastMessage.innerHTML = '';
    }

    getNoDataHTML() {
        return `<div class="dt-scrollable__no-data">${this.options.noDataMessage}</div>`;
    }

    getToastMessageHTML(message) {
        return `<span class="dt-toast__message">${message}</span>`;
    }
}
