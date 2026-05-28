import React, { useEffect, useState } from 'react';
import { Button, Col, Form, Input, Row, Select, Space, Tag, message } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { merchantApi } from '../api';

const { TextArea } = Input;
const { Option } = Select;

interface MerchantIntroRecord {
  id: number;
  name: string;
  category?: string;
  platform?: string;
  cooperation_mode?: string;
  commission_rate?: number;
  status?: string;
  brand_intro?: string;
  brand_assistants?: string;
  brand_live_venue?: string;
  brand_cards?: string;
  other_files?: string;
  [key: string]: any;
}

const urlRegex = /(https?:\/\/[^\s)]+)/g;
const imageMarkdownRegex = /!\[[^\]]*]\(([^)]+)\)/g;

const MerchantIntroduction: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnState = location.state as { from?: string; fromLabel?: string } | null;
  const returnPath = returnState?.from || '/merchants';
  const returnLabel = returnState?.fromLabel || '返回商家管理';
  const [merchant, setMerchant] = useState<MerchantIntroRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchMerchant();
  }, [id]);

  const fetchMerchant = async () => {
    setLoading(true);
    try {
      const res = await merchantApi.getAll();
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      const found = data.find((item: MerchantIntroRecord) => String(item.id) === String(id));
      if (!found) {
        message.error('未找到商家');
        navigate(returnPath);
        return;
      }
      setMerchant(found);
      form.setFieldsValue(found);
    } catch (error) {
      console.error('获取商家介绍失败:', error);
      message.error('获取商家介绍失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!merchant) return;
    const values = await form.validateFields();
    try {
      await merchantApi.update(merchant.id, { ...merchant, ...values });
      message.success('商家介绍已保存');
      fetchMerchant();
    } catch (error) {
      console.error('保存商家介绍失败:', error);
      message.error('保存失败');
    }
  };

  const platformText = merchant?.platform === 'Both' ? '双平台' : merchant?.platform;
  const appendToField = (field: string, text: string) => {
    const current = form.getFieldValue(field) || '';
    form.setFieldValue(field, current ? `${current}\n${text}` : text);
  };

  const handleResourcePaste = (field: string) => (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItems = Array.from(event.clipboardData.items).filter((item) => item.type.startsWith('image/'));
    if (!imageItems.length) return;

    event.preventDefault();
    imageItems.forEach((item) => {
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        appendToField(field, `![图片](${reader.result})`);
        message.success('图片已粘贴，可在下方预览打开');
      };
      reader.readAsDataURL(file);
    });
  };

  const renderResourcePreview = (value?: string) => {
    if (!value) return null;
    const imageUrls = Array.from(value.matchAll(imageMarkdownRegex)).map((match) => match[1]);
    const textWithoutImages = value.replace(imageMarkdownRegex, '');
    const linkUrls = Array.from(textWithoutImages.matchAll(urlRegex)).map((match) => match[1]);

    if (!imageUrls.length && !linkUrls.length) return null;

    return (
      <div className="merchant-resource-preview">
        {imageUrls.map((url, index) => (
          <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="merchant-resource-image-link">
            <img src={url} alt={`粘贴图片 ${index + 1}`} />
          </a>
        ))}
        {linkUrls.map((url, index) => (
          <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="merchant-resource-link">
            打开链接 {index + 1}
          </a>
        ))}
      </div>
    );
  };

  const renderResourceField = (name: string, label: string, rows: number, placeholder: string) => (
    <>
      <Form.Item name={name} label={label}>
        <TextArea rows={rows} placeholder={placeholder} onPaste={handleResourcePaste(name)} />
      </Form.Item>
      <Form.Item shouldUpdate noStyle>
        {() => renderResourcePreview(form.getFieldValue(name))}
      </Form.Item>
    </>
  );

  return (
    <div>
      <Space style={{ marginBottom: 18, width: '100%', justifyContent: 'space-between' }} align="center">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(returnPath)}>{returnLabel}</Button>
          <div>
            <h2 style={{ margin: 0 }}>{merchant?.name || '商家介绍'}</h2>
            <Space style={{ marginTop: 8 }}>
              {merchant?.category ? <Tag color="blue">{merchant.category}</Tag> : null}
              {platformText ? <Tag color="red">{platformText}</Tag> : null}
              {merchant?.cooperation_mode ? <Tag color="purple">{merchant.cooperation_mode}</Tag> : null}
            </Space>
          </div>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSave}>保存</Button>
      </Space>

      <Form form={form} layout="vertical">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <section className="merchant-intro-section">
              <h3>品牌介绍</h3>
              {renderResourceField('brand_intro', '品牌介绍', 8, '填写品牌定位、卖点、目标人群、直播话术重点等；可粘贴图片或飞书链接')}
            </section>
          </Col>

          <Col xs={24} lg={12}>
            <section className="merchant-intro-section">
              <h3>品牌助播</h3>
              {renderResourceField('brand_assistants', '品牌助播', 8, '填写品牌方助播、对接人、支持人员及联系方式；可粘贴图片或飞书链接')}
            </section>
          </Col>

          <Col xs={24} lg={12}>
            <section className="merchant-intro-section">
              <h3>品牌直播场地</h3>
              {renderResourceField('brand_live_venue', '品牌直播场地', 6, '填写直播城市、场地地址、设备、网络、进场要求等；可粘贴图片或飞书链接')}
            </section>
          </Col>

          <Col xs={24} lg={12}>
            <section className="merchant-intro-section">
              <h3>品牌手卡</h3>
              {renderResourceField('brand_cards', '品牌手卡', 6, '填写手卡链接、产品话术、禁忌点、促销机制等；可粘贴图片或飞书链接')}
            </section>
          </Col>

          <Col span={24}>
            <section className="merchant-intro-section">
              <h3>其他文件</h3>
              {renderResourceField('other_files', '其他文件', 5, '填写其他飞书、网盘、图片、合同或素材链接；多条可换行')}
            </section>
          </Col>
        </Row>

        <Form.Item name="name" hidden><Input /></Form.Item>
        <Form.Item name="category" hidden><Input /></Form.Item>
        <Form.Item name="contact_person" hidden><Input /></Form.Item>
        <Form.Item name="email" hidden><Input /></Form.Item>
        <Form.Item name="phone" hidden><Input /></Form.Item>
        <Form.Item name="platform" hidden><Input /></Form.Item>
        <Form.Item name="cooperation_mode" hidden><Input /></Form.Item>
        <Form.Item name="commission_rate" hidden><Input /></Form.Item>
        <Form.Item name="settlement_cycle" hidden><Input /></Form.Item>
        <Form.Item name="status" hidden>
          <Select><Option value="active">活跃</Option><Option value="inactive">停用</Option></Select>
        </Form.Item>
        <Form.Item name="notes" hidden><Input /></Form.Item>
        <Form.Item name="supply_price_sheet_url" hidden><Input /></Form.Item>
        <Form.Item name="cargo_sheet_url" hidden><Input /></Form.Item>
        <Form.Item name="cooperation_notes" hidden><Input /></Form.Item>
        <Form.Item name="brand_address" hidden><Input /></Form.Item>
      </Form>
    </div>
  );
};

export default MerchantIntroduction;
