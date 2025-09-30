// Centralized item options map (by food _id), separate from food_list
// This allows future APIs for store owners to manage options independently.

export const item_options = {
  "9": [
    {
      title: 'Kích cỡ',
      type: 'single',
      required: true,
      options: [
        { label: 'Nhỏ', priceDelta: 0 },
        { label: 'Vừa', priceDelta: 5000 },
        { label: 'Lớn', priceDelta: 10000 },
      ],
    },
    {
      title: 'Topping',
      type: 'multi',
      required: false,
      options: [
        { label: 'Thạch', priceDelta: 3000 },
        { label: 'Trân châu', priceDelta: 4000 },
        { label: 'Kem', priceDelta: 6000 },
      ],
    },
    {
      title: 'Đá',
      type: 'multi',
      required: false,
      options: [
        { label: 'Đá ít', priceDelta: 3000 },
        { label: 'Đá nhiều', priceDelta: 4000 },
        { label: 'Đá bình thường', priceDelta: 6000 },
      ],
    },
  ],
  "26": [
    {
      title: 'Lựa chọn đá',
      type: 'single',
      required: true,
      options: [
        { label: 'Không đá', priceDelta: 0 },
        { label: 'Ít đá', priceDelta: 0 },
        { label: 'Đá riêng', priceDelta: 0 },
      ],
    },
    {
      title: 'Thêm phô mai',
      type: 'multi',
      required: false,
      options: [
        { label: 'Parmesan', priceDelta: 5000 },
        { label: 'Mozzarella', priceDelta: 7000 },
      ],
    },
  ],
};

export default item_options;
