import React from 'react';

const DataTable = ({ columns, data, actions, getRowClassName }) => {
  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
      <table className="w-full text-left border-collapse">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, index) => (
              <th 
                key={col.header || `header-${index}`} 
                className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
            {actions && (
              <th key="actions-header" className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, rowIndex) => {
            const rowKey = row.id || `row-${rowIndex}`;
            
            return (
              <tr
                key={rowKey}
                className={`hover:bg-gray-50 transition-colors ${getRowClassName?.(row) || ''}`}
              >
                {columns.map((col, colIndex) => {
                  const cellValue = row[col.accessor];
                  
                  return (
                    <td 
                      key={`${rowKey}-cell-${colIndex}`} 
                      className="px-6 py-4 text-sm text-gray-700 align-top"
                    >
                      {col.render 
                        ? col.render(cellValue, row) 
                        : (typeof cellValue === 'object' ? '' : cellValue)}
                    </td>
                  );
                })}
                
                {actions && (
                  <td key={`${rowKey}-actions`} className="px-6 py-4 text-sm align-top">
                    {actions(row)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;