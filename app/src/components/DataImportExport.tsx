import React, { useState } from 'react';
import { Upload, Button, Modal, message, Space, Tooltip } from 'antd';
import { UploadOutlined, DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

interface DataImportExportProps {
  entityName: string;
  templateColumns: { key: string; label: string; required?: boolean }[];
  onImport: (data: any[]) => Promise<void>;
  onExport?: () => Promise<any[]>;
}

const DataImportExport: React.FC<DataImportExportProps> = ({
  entityName,
  templateColumns,
  onImport,
  onExport
}) => {
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);

  const normalizeHeader = (value: string) => value.replace(/^\uFEFF/, '').trim();

  // 下载模板
  const handleDownloadTemplate = () => {
    const templateData = [{}];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '模板');

    // 设置表头
    const header = templateColumns.map(col => col.label);
    XLSX.utils.sheet_add_aoa(ws, [header], { origin: 'A1' });
    ws['!cols'] = templateColumns.map((col) => ({
      wch: Math.max(12, Math.min(28, col.label.length * 2 + 4)),
    }));

    XLSX.writeFile(wb, `${entityName}_导入模板.xlsx`);
    message.success('模板下载成功');
  };

  // 导出数据
  const handleExport = async () => {
    if (!onExport) {
      message.warning('导出功能暂未实现');
      return;
    }

    try {
      setLoading(true);
      const data = await onExport();

      if (!data || data.length === 0) {
        message.info('暂无数据可导出');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, entityName);

      const timestamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `${entityName}_${timestamp}.xlsx`);
      message.success('数据导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理文件上传
  const handleUpload = async (file: File) => {
    setLoading(true);

    try {
      const rawData = await parseExcelFile(file);
      const data = rawData.map((row) => {
        const normalized: Record<string, any> = {};
        const cleanedRow = Object.entries(row).reduce((acc, [key, value]) => {
          acc[normalizeHeader(key)] = value;
          return acc;
        }, {} as Record<string, any>);

        templateColumns.forEach((column) => {
          normalized[column.key] = cleanedRow[column.key] ?? cleanedRow[normalizeHeader(column.label)] ?? '';
        });

        Object.entries(cleanedRow).forEach(([key, value]) => {
          if (!(key in normalized)) {
            normalized[key] = value;
          }
        });

        return normalized;
      });

      if (!data || data.length === 0) {
        message.error('文件中没有数据');
        return false;
      }

      // 验证必填字段
      const requiredFields = templateColumns.filter(col => col.required);
      const missingFields = requiredFields.filter((field) => {
        return data.every((row) => {
          const value = row[field.key];
          return value === undefined || value === null || String(value).trim() === '';
        });
      });

      if (missingFields.length > 0) {
        message.error(`缺少必填字段: ${missingFields.map((field) => field.label).join('、')}`);
        return false;
      }

      // 执行导入
      await onImport(data);
      message.success(`成功导入 ${data.length} 条${entityName}数据`);
      setImportModalVisible(false);
      setFileList([]);

      return true;
    } catch (error) {
      message.error('导入失败: ' + (error as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 解析Excel文件
  const parseExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
          const headers: string[] = [];

          for (let column = range.s.c; column <= range.e.c; column += 1) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })];
            headers[column] = normalizeHeader(cell ? XLSX.utils.format_cell(cell) : '');
          }

          const jsonData = [];
          for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
            const rowData: Record<string, any> = {};
            let hasValue = false;

            for (let column = range.s.c; column <= range.e.c; column += 1) {
              const header = headers[column];
              if (!header) continue;

              const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
              const hyperlink = cell?.l?.Target;
              const value = hyperlink || (cell ? XLSX.utils.format_cell(cell) : '');

              rowData[header] = value;
              if (value !== undefined && value !== null && String(value).trim() !== '') {
                hasValue = true;
              }
            }

            if (hasValue) {
              jsonData.push(rowData);
            }
          }
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (error) => {
        reject(error);
      };

      reader.readAsArrayBuffer(file);
    });
  };

  const uploadProps = {
    accept: '.xlsx,.xls,.csv',
    beforeUpload: handleUpload,
    fileList,
    onChange: ({ fileList }: any) => setFileList(fileList),
    onRemove: () => setFileList([]),
    showUploadList: false
  };

  return (
    <Space>
      <Tooltip title={`下载${entityName}导入模板`}>
        <Button
          type="default"
          icon={<FileExcelOutlined />}
          onClick={handleDownloadTemplate}
        >
          下载模板
        </Button>
      </Tooltip>

      {onExport && (
        <Tooltip title={`导出${entityName}数据`}>
          <Button
            type="default"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={loading}
          >
            导出数据
          </Button>
        </Tooltip>
      )}

      <Tooltip title={`批量导入${entityName}数据`}>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => setImportModalVisible(true)}
        >
          批量导入
        </Button>
      </Tooltip>

      <Modal
        title={`批量导入${entityName}`}
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ padding: '20px 0' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 12, color: 'rgba(0,0,0,0.45)' }}>
                <strong>步骤 1:</strong> 下载导入模板
              </div>
              <Button
                type="default"
                icon={<FileExcelOutlined />}
                onClick={handleDownloadTemplate}
                block
              >
                下载 {entityName} 导入模板
              </Button>
            </div>

            <div>
              <div style={{ marginBottom: 12, color: 'rgba(0,0,0,0.45)' }}>
                <strong>步骤 2:</strong> 填写数据并上传
              </div>
              <Upload {...uploadProps} disabled={loading}>
                <Button loading={loading} block>
                  {loading ? '导入中...' : '选择文件'}
                </Button>
              </Upload>
              <div style={{ marginTop: 8, color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                支持 .xlsx, .xls, .csv 格式
              </div>
            </div>

            <div style={{
              padding: 12,
              background: '#f0f2f5',
              borderRadius: 4,
              fontSize: 12,
              color: 'rgba(0,0,0,0.65)'
            }}>
              <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                必填字段:
              </div>
              {templateColumns.filter(col => col.required).map(col => (
                <div key={col.key}>
                  • {col.label} ({col.key})
                </div>
              ))}
            </div>
          </Space>
        </div>
      </Modal>
    </Space>
  );
};

export default DataImportExport;
