import logo from './logo.png'
import add_icon from './add_icon.png'
import order_icon from './order_icon.png'
import profile_image from './profile_image.png'
import upload_area from './upload_area.png'
import parcel_icon from './parcel_icon.png'
import basket_icon from './basket_icon.png'
import header_img from './header_img.png'
import search_icon from './search_icon.png'
import menu_1 from './menu_1.png'
import menu_2 from './menu_2.png'
import menu_3 from './menu_3.png'
import menu_4 from './menu_4.png'
import menu_5 from './menu_5.png'
import menu_6 from './menu_6.png'
import menu_7 from './menu_7.png'
import menu_8 from './menu_8.png'

import food_1 from './food_1.png'
import food_2 from './food_2.png'
import food_3 from './food_3.png'
import food_4 from './food_4.png'
import food_5 from './food_5.png'
import food_6 from './food_6.png'
import food_7 from './food_7.png'
import food_8 from './food_8.png'
import food_9 from './food_9.png'
import food_10 from './food_10.png'
import food_11 from './food_11.png'
import food_12 from './food_12.png'
import food_13 from './food_13.png'
import food_14 from './food_14.png'
import food_15 from './food_15.png'
import food_16 from './food_16.png'
import food_17 from './food_17.png'
import food_18 from './food_18.png'
import food_19 from './food_19.png'
import food_20 from './food_20.png'
import food_21 from './food_21.png'
import food_22 from './food_22.png'
import food_23 from './food_23.png'
import food_24 from './food_24.png'
import food_25 from './food_25.png'
import food_26 from './food_26.png'
import food_27 from './food_27.png'
import food_28 from './food_28.png'
import food_29 from './food_29.png'
import food_30 from './food_30.png'
import food_31 from './food_31.png'
import food_32 from './food_32.png'
import up from './up.png'
import down from './down.png'
import add_icon_white from './add_icon_white.png'
import add_icon_green from './add_icon_green.png'
import remove_icon_red from './remove_icon_red.png'
import app_store from './app_store.png'
import play_store from './play_store.png'
import linkedin_icon from './linkedin_icon.png'
import facebook_icon from './facebook_icon.png'
import twitter_icon from './twitter_icon.png'
import cross_icon from './cross_icon.png'
import selector_icon from './selector_icon.png'
import detail_icon from './detail_icon.png'
import rating_starts from './rating_starts.png'
import profile_icon from './profile_icon.png'
import bag_icon from './bag_icon.png'
import logout_icon from './logout_icon.png'
import back from './Back.png'
import category_icon from './category_icon.png'
import trash from './trash.png'
import edit from './edit.png'
import checked from './checked.png'
import clock from './clock.png'
import delivery from './delivery.png'
import refresh from './refresh.png'
import cancel from './cancel.png'
export const assets ={
    back,
    add_icon,
    order_icon,
    profile_image,
    upload_area,
    parcel_icon,
    logo,
    basket_icon,
    header_img,
    search_icon,
    rating_starts,
    add_icon_green,
    add_icon_white,
    remove_icon_red,
    app_store,
    play_store,
    linkedin_icon,
    facebook_icon,
    twitter_icon,
    cross_icon,
    selector_icon,
    detail_icon,
    profile_icon,
    logout_icon,
    bag_icon,
    menu_1,
    up,
    down,
    category_icon,
    edit,
    trash,
    checked,
    clock,
    delivery,
    refresh,
    cancel
}

export const url = 'http://localhost:4000'
export const menu_list = [
    { menu_name: "Cơm", menu_image: menu_1 },
    { menu_name: "Trà sữa", menu_image: menu_2 },
    { menu_name: "Bún - Phở", menu_image: menu_3 },
    { menu_name: "Cà phê", menu_image: menu_4 },
    { menu_name: "Bánh mì - Xôi", menu_image: menu_5 },
    { menu_name: "Đồ ăn healthy", menu_image: menu_6 },
    { menu_name: "Ăn vặt", menu_image: menu_7 },
    { menu_name: "Tráng miệng", menu_image: menu_8 }
]

export const restaurant_list = [
    {
        _id: "1",
        name: "Nhà hàng Phố Cổ",
        image: food_1,
        rating: 4.5,
        description: "Nhà hàng phục vụ các món ăn truyền thống Việt Nam với hương vị đậm đà",
        address: "123 Phố Cổ, Hoàn Kiếm, Hà Nội",
        cuisine: "Món Việt"
    },
    {
        _id: "2", 
        name: "Quán Bún Chả Hương Liên",
        image: food_2,
        rating: 4.8,
        description: "Nổi tiếng với món bún chả Hà Nội đúng vị, từng được Tổng thống Obama ghé thăm",
        address: "24 Lê Văn Hưu, Hai Bà Trưng, Hà Nội",
        cuisine: "Bún Chả"
    },
    {
        _id: "3",
        name: "Pizza 4P's",
        image: food_3,
        rating: 4.6,
        description: "Chuỗi nhà hàng pizza nổi tiếng với nguyên liệu tươi ngon và phong cách Nhật Bản",
        address: "8/15 Lê Thánh Tôn, Quận 1, TP.HCM",
        cuisine: "Pizza Italia"
    },
    {
        _id: "4",
        name: "Cơm Tấm Kiều Giang",
        image: food_4,
        rating: 4.3,
        description: "Cơm tấm sườn nướng truyền thống với hương vị đặc trưng miền Nam",
        address: "60A Nguyễn Du, Quận 1, TP.HCM",
        cuisine: "Cơm Tấm"
    },
    {
        _id: "5",
        name: "Phở Hòa Pasteur",
        image: food_5,
        rating: 4.7,
        description: "Phở bò truyền thống với nước dùng trong vắt và thịt bò tươi ngon",
        address: "421C Nguyễn Thị Minh Khai, Quận 3, TP.HCM",
        cuisine: "Phở"
    },
    {
        _id: "6",
        name: "Bánh Mì Huỳnh Hoa",
        image: food_6,
        rating: 4.4,
        description: "Bánh mì thập cẩm nổi tiếng với nhân đầy đặn và bánh giòn rụm",
        address: "26 Lê Thị Riêng, Quận 1, TP.HCM",
        cuisine: "Bánh Mì"
    },
    {
        _id: "7",
        name: "Lẩu Thái Lan Bangkok",
        image: food_7,
        rating: 4.2,
        description: "Lẩu Thái chua cay đậm đà với hải sản tươi sống",
        address: "156 Võ Văn Tần, Quận 3, TP.HCM",
        cuisine: "Lẩu Thái"
    },
    {
        _id: "8",
        name: "Sushi Hokkaido Sachi",
        image: food_8,
        rating: 4.9,
        description: "Sushi Nhật Bản cao cấp với cá tươi được nhập khẩu trực tiếp",
        address: "72 Hai Bà Trưng, Quận 1, TP.HCM",
        cuisine: "Sushi Nhật"
    },
    // Thêm mới
    {
        _id: "9",
        name: "Trà Sữa Gong Cha",
        image: food_9,
        rating: 4.1,
        description: "Chuỗi trà sữa Đài Loan với nhiều lựa chọn topping phong phú",
        address: "45 Nguyễn Huệ, Quận 1, TP.HCM",
        cuisine: "Trà Sữa"
    },
    {
        _id: "10",
        name: "Highlands Coffee",
        image: food_10,
        rating: 4.0,
        description: "Cà phê phin và đồ uống hiện đại trong không gian thân thiện",
        address: "101 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội",
        cuisine: "Cà Phê"
    },
    {
        _id: "11",
        name: "Bánh Mì Minh Nhật",
        image: food_11,
        rating: 4.3,
        description: "Bánh mì Việt Nam với nhân đa dạng và nước sốt đặc trưng",
        address: "12 Hàng Bạc, Hoàn Kiếm, Hà Nội",
        cuisine: "Bánh Mì"
    },
    {
        _id: "12",
        name: "Xôi Yến",
        image: food_12,
        rating: 4.4,
        description: "Quán xôi nổi tiếng với xôi xéo, pate và hành phi thơm giòn",
        address: "35B Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội",
        cuisine: "Xôi"
    },
    {
        _id: "13",
        name: "Cà Phê Phúc Long",
        image: food_13,
        rating: 4.2,
        description: "Trà và cà phê đậm vị, nổi bật với trà sữa và bánh ngọt kèm",
        address: "2A Tôn Đức Thắng, Quận 1, TP.HCM",
        cuisine: "Cà Phê"
    },
    {
        _id: "14",
        name: "The Coffee House",
        image: food_14,
        rating: 4.5,
        description: "Không gian hiện đại, đồ uống đa dạng từ cà phê đến trà trái cây",
        address: "86 Đồng Khởi, Quận 1, TP.HCM",
        cuisine: "Cà Phê"
    },
    {
        _id: "15",
        name: "Trà Sữa Phúc Tea",
        image: food_15,
        rating: 3.9,
        description: "Trà sữa vị thanh, trân châu mềm dai nấu trong ngày",
        address: "189 Nguyễn Trãi, Quận 5, TP.HCM",
        cuisine: "Trà Sữa"
    },
    {
        _id: "16",
        name: "Lẩu Hồ Quang",
        image: food_16,
        rating: 4.1,
        description: "Lẩu nước dùng đậm đà với hải sản và thịt bò tươi",
        address: "58 Trường Sa, Bình Thạnh, TP.HCM",
        cuisine: "Lẩu Thái"
    },
    {
        _id: "17",
        name: "Cơm Gà Hội An",
        image: food_17,
        rating: 4.6,
        description: "Cơm gà xé Hội An chuẩn vị kèm nước mắm tỏi ớt đặc biệt",
        address: "20 Nguyễn Văn Thủ, Quận 1, TP.HCM",
        cuisine: "Cơm"
    },
    {
        _id: "18",
        name: "Dessert Corner",
        image: food_18,
        rating: 4.3,
        description: "Quán tráng miệng với bánh ngọt Âu - Á và thức uống nhẹ",
        address: "14 Thảo Điền, TP. Thủ Đức, TP.HCM",
        cuisine: "Tráng Miệng"
    },

]
export const food_list = [
    { _id: "1", restaurantId: "1", name: "Greek salad", image: food_1, price: 25000, description: "Food provides essential nutrients...", category: "Đồ ăn healthy", status: "available" },
    { _id: "2", restaurantId: "1", name: "Veg salad", image: food_2, price: 18000, description: "Food provides essential nutrients...", category: "Đồ ăn healthy", status: "available" },
    { _id: "3", restaurantId: "1", name: "Clover Salad", image: food_3, price: 16000, description: "Food provides essential nutrients...", category: "Đồ ăn healthy", status: "unavailable" },
    { _id: "4", restaurantId: "1", name: "Chicken Salad", image: food_4, price: 24000, description: "Food provides essential nutrients...", category: "Đồ ăn healthy", status: "available" },

    { _id: "5", restaurantId: "1", name: "Lasagna Rolls", image: food_5, price: 14000, description: "Food provides essential nutrients...", category: "Đồ ăn healthy", status: "available" },
    { _id: "6", restaurantId: "1", name: "Peri Peri Rolls", image: food_6, price: 12000, description: "Food provides essential nutrients...", category: "Cơm", status: "unavailable" },
    { _id: "7", restaurantId: "1", name: "Chicken Rolls", image: food_7, price: 20000, description: "Food provides essential nutrients...", category: "Cơm", status: "available" },
    { _id: "8", restaurantId: "1", name: "Veg Rolls", image: food_8, price: 15000, description: "Food provides essential nutrients...", category: "Cơm", status: "available" },

    { _id: "9", restaurantId: "3", name: "Ripple Ice Cream", image: food_9, price: 14000, description: "Food provides essential nutrients...", category: "Tráng miệng", status: "available" },
    { _id: "10", restaurantId: "3", name: "Fruit Ice Cream", image: food_10, price: 22000, description: "Food provides essential nutrients...", category: "Tráng miệng", status: "available" },
    { _id: "11", restaurantId: "3", name: "Jar Ice Cream", image: food_11, price: 10000, description: "Food provides essential nutrients...", category: "Tráng miệng", status: "unavailable" },
    { _id: "12", restaurantId: "3", name: "Vanilla Ice Cream", image: food_12, price: 12000, description: "Food provides essential nutrients...", category: "Tráng miệng", status: "available" },

    { _id: "13", restaurantId: "4", name: "Chicken Sandwich", image: food_13, price: 12000, description: "Food provides essential nutrients...", category: "Ăn vặt", status: "available" },
    { _id: "14", restaurantId: "4", name: "Vegan Sandwich", image: food_14, price: 18000, description: "Food provides essential nutrients...", category: "Ăn vặt", status: "available" },
    { _id: "15", restaurantId: "4", name: "Grilled Sandwich", image: food_15, price: 16000, description: "Food provides essential nutrients...", category: "Ăn vặt", status: "unavailable" },
    { _id: "16", restaurantId: "4", name: "Bread Sandwich", image: food_16, price: 24000, description: "Food provides essential nutrients...", category: "Ăn vặt", status: "available" },

    { _id: "17", restaurantId: "5", name: "Cup Cake", image: food_17, price: 14000, description: "Food provides essential nutrients...", category: "Tráng miệng", status: "available" },
    { _id: "18", restaurantId: "5", name: "Vegan Cake", image: food_18, price: 12000, description: "Food provides essential nutrients...", category: "Tráng miệng", status: "available" },
    { _id: "19", restaurantId: "5", name: "Butterscotch Cake", image: food_19, price: 20000, description: "Food provides essential nutrients...", category: "Tráng miệng", status: "available" },
    { _id: "20", restaurantId: "5", name: "Sliced Cake", image: food_20, price: 15000, description: "Food provides essential nutrients...", category: "Tráng miệng", status: "unavailable" },

    { _id: "21", restaurantId: "6", name: "Garlic Mushroom", image: food_21, price: 14000, description: "Food provides essential nutrients...", category: "Đồ ăn healthy", status: "available" },
    { _id: "22", restaurantId: "6", name: "Fried Cauliflower", image: food_22, price: 22000, description: "Food provides essential nutrients...", category: "Đồ ăn healthy", status: "available" },
    { _id: "23", restaurantId: "6", name: "Mix Veg Pulao", image: food_23, price: 10000, description: "Food provides essential nutrients...", category: "Đồ ăn healthy", status: "unavailable" },
    { _id: "24", restaurantId: "6", name: "Rice Zucchini", image: food_24, price: 12000, description: "Food provides essential nutrients...", category: "Đồ ăn healthy", status: "available" },

    { _id: "25", restaurantId: "7", name: "Cheese Pasta", image: food_25, price: 50600, description: "Food provides essential nutrients...", category: "Cơm", status: "available" },
    { _id: "26", restaurantId: "7", name: "Tomato Pasta", image: food_26, price: 18000, description: "Food provides essential nutrients...", category: "Cơm", status: "available" },
    { _id: "27", restaurantId: "7", name: "Creamy Pasta", image: food_27, price: 16000, description: "Food provides essential nutrients...", category: "Cơm", status: "unavailable" },
    { _id: "28", restaurantId: "7", name: "Chicken Pasta", image: food_28, price: 24000, description: "Food provides essential nutrients...", category: "Cơm", status: "available" },

    { _id: "29", restaurantId: "8", name: "Butter Noodles", image: food_29, price: 14000, description: "Food provides essential nutrients...", category: "Cơm", status: "available" },
    { _id: "30", restaurantId: "8", name: "Veg Noodles", image: food_30, price: 12000, description: "Food provides essential nutrients...", category: "Cơm", status: "available" },
    { _id: "31", restaurantId: "8", name: "Somen Noodles", image: food_31, price: 20000, description: "Food provides essential nutrients...", category: "Cơm", status: "unavailable" },
    { _id: "32", restaurantId: "8", name: "Cooked Noodles", image: food_32, price: 15000, description: "Food provides essential nutrients...", category: "Cơm", status: "available" },

    // --- Extra demo items for restaurantId: "3" to test category grouping ---
    { _id: "33", restaurantId: "3", name: "Bánh Midnight Matcha", image: food_19, price: 36000, description: "Bánh choco nhân ganache matcha béo thơm.", category: "Món được yêu thích", status: "available" },
    { _id: "34", restaurantId: "3", name: "Bánh Sừng Bò Matcha", image: food_14, price: 17600, description: "Cornet giòn rụm với nhân kem matcha.", category: "Món được yêu thích", status: "available" },
    { _id: "35", restaurantId: "3", name: "Hộp Tiramisu Matcha", image: food_20, price: 216000, description: "Mousse matcha & phô mai mascarpone.", category: "Món được yêu thích", status: "unavailable" },

    { _id: "36", restaurantId: "3", name: "Croissant Trà Xanh Hạt Dẻ", image: food_17, price: 31200, description: "Lớp sừng trâu choco cùng nhân kem matcha.", category: "Phổ biến", status: "available" },
    { _id: "37", restaurantId: "3", name: "Bánh Mì Kem Matcha Socola", image: food_16, price: 29000, description: "Bánh mì phủ choco kèm nhân matcha thơm.", category: "Phổ biến", status: "unavailable" },

    { _id: "38", restaurantId: "3", name: "Bánh Trung Thu Thập Cẩm", image: food_25, price: 56000, description: "Bánh trung thu thập cẩm truyền thống.", category: "Bánh trung thu", status: "available" },
    { _id: "39", restaurantId: "3", name: "Bánh Trung Thu Matcha Đậu Đỏ", image: food_26, price: 62000, description: "Nhân matcha hòa quyện đậu đỏ.", category: "Bánh trung thu", status: "available" },

    { _id: "40", restaurantId: "3", name: "Bánh Mới Vị Kem Dừa", image: food_18, price: 33000, description: "Sản phẩm mới, vị kem dừa thanh mát.", category: "Sản phẩm mới", status: "available" },
    { _id: "41", restaurantId: "3", name: "Bánh Quy Bơ Nướng", image: food_15, price: 24000, description: "Bánh quy bơ giòn, mới ra lò.", category: "Sản phẩm mới", status: "unavailable" },

    { _id: "42", restaurantId: "3", name: "Sandwich Gà Teriyaki", image: food_13, price: 42000, description: "Sandwich gà sốt teriyaki đậm đà.", category: "Sandwich", status: "available" },
    { _id: "43", restaurantId: "3", name: "Bánh Mì Trứng Muối", image: food_11, price: 38000, description: "Bánh mì nhân sốt trứng muối mặn mà.", category: "Bánh mì", status: "available" },
    { _id: "44", restaurantId: "3", name: "Cà Phê Sữa Matcha", image: food_10, price: 32000, description: "Kết hợp cà phê sữa và matcha lạ miệng.", category: "Cà phê", status: "unavailable" },
    { _id: "45", restaurantId: "3", name: "Bánh Kem Tiramisu Nhỏ", image: food_12, price: 65000, description: "Bánh kem tiramisu size 10cm.", category: "Bánh kem", status: "available" },
    { _id: "46", restaurantId: "3", name: "Bánh Healthy Granola Bar", image: food_21, price: 27000, description: "Thanh granola yến mạch hạnh nhân.", category: "Healthy", status: "available" },
    { _id: "47", restaurantId: "3", name: "Trà Sữa Matcha Kem Cheese", image: food_9, price: 39000, description: "Trà sữa matcha phủ kem cheese mặn.", category: "Trà/Café", status: "available" },
    { _id: "48", restaurantId: "3", name: "Bánh Ngọt Bơ Sữa", image: food_22, price: 30000, description: "Bánh ngọt mềm, thơm bơ sữa.", category: "Bánh ngọt", status: "available" }
];

export const order_list = [
  {
    id: 1,
    user_id: 101,
    full_name: "Nguyễn Văn A",
    phone: "0901234567",
    address: "123 Phố Cổ, Hoàn Kiếm, Hà Nội",
    created_at: "2025-09-29T10:15:00",
    status: "delivered",
    total_amount: 120000,
    items: [
      {
        dish_id: 1,
        name: "Greek salad",
        quantity: 2,
        base_price: 25000,
        subtotal: 50000,
        options: [
          { option: "Không hành", extra_price: 0 },
        ]
      },
      {
        dish_id: 7,
        name: "Chicken Rolls",
        quantity: 1,
        base_price: 20000,
        subtotal: 20000,
        options: []
      }
    ],
    payment: {
      method: "cash",
      status: "paid"
    }
  },
  {
    id: 2,
    user_id: 102,
    full_name: "Trần Thị B",
    phone: "0912345678",
    address: "8/15 Lê Thánh Tôn, Quận 1, TP.HCM",
    created_at: "2025-09-30T08:30:00",
    status: "pending",
    total_amount: 65000,
    items: [
      {
        dish_id: 45,
        name: "Bánh Kem Tiramisu Nhỏ",
        quantity: 1,
        base_price: 65000,
        subtotal: 65000,
        options: []
      }
    ],
    payment: {
      method: "momo",
      status: "unpaid"
    }
  },
  {
    id: 3,
    user_id: 103,
    full_name: "Lê Văn C",
    phone: "0987654321",
    address: "421C Nguyễn Thị Minh Khai, Quận 3, TP.HCM",
    created_at: "2025-09-28T19:45:00",
    status: "canceled",
    total_amount: 0,
    items: [],
    payment: {
      method: "cash",
      status: "canceled"
    }
  }
];