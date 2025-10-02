import React, { useEffect, useState } from 'react'
import { assets } from '../../assets/assets';
import './Add.css';
import { NavLink, useNavigate } from 'react-router-dom';
import merchantAPI from '../../api/merchantAPI';
const Add = () => {
    const [image, setImage] = useState(false);
    const [data, setData] = useState({
        name: "",
        description: "",
        category: "", // will map -> categoryId
        price: ""      // will map -> basePrice
    });
    const [submitting, setSubmitting] = useState(false);
    const [categories, setCategories] = useState([]);
    const navigate = useNavigate();
    const onChangeHandler = (event) => {
        const name = event.target.name;
        const value = event.target.value;
        setData(data =>({...data, [name]:value}))
    }
    useEffect(() => {
        (async () => {
            try {
                const list = await merchantAPI.getCategories();
                const normalized = (Array.isArray(list) ? list : []).map(x => ({
                    id: x?.id ?? x?._id ?? x?.categoryId,
                    name: x?.name ?? x?.categoryName ?? x?.title,
                })).filter(it => it.id != null);
                setCategories(normalized);
            } catch (e) {
                // ignore silently in add page
            }
        })();
    }, []);
    const onSubmitHandler = async (event) => {
        event.preventDefault();
        if (submitting) return;
        try {
            setSubmitting(true);
            const formData = new FormData();
            // Backend expects: categoryId, name, description, basePrice, imgFile
            const name = (data.name || '').trim();
            const description = (data.description || '').trim();
            const categoryIdNum = Number(data.category);
            const basePriceNum = Number(data.price);

            if (!image) throw new Error('Vui lòng chọn hình ảnh');
            if (!name) throw new Error('Vui lòng nhập tên sản phẩm');
            if (!description) throw new Error('Vui lòng nhập mô tả');
            if (!Number.isFinite(categoryIdNum) || categoryIdNum <= 0) throw new Error('CategoryId phải là số dương');
            if (!Number.isFinite(basePriceNum) || basePriceNum <= 0) throw new Error('Giá cơ bản phải là số dương');

            formData.append('imgFile', image);
            formData.append('name', name);
            formData.append('description', description);
            formData.append('categoryId', String(categoryIdNum));
            formData.append('basePrice', String(basePriceNum));

            // Debug: log form entries (không log binary file)
            try {
                const dbg = [];
                for (const [k, v] of formData.entries()) {
                    dbg.push([k, v instanceof File ? `File(${v.name}, ${v.type}, ${v.size}B)` : v]);
                }
                // eslint-disable-next-line no-console
                console.log('[Add] submit formData =', dbg);
            } catch {}

            await merchantAPI.createMenuItem(formData);
            // small UX: reset and go back to list
            setImage(false);
            setData({ name: '', description: '', category: '', price: '' });
            navigate('/list');
        } catch (err) {
            // Một số backend vẫn tạo thành công nhưng trả 500.
            // Kiểm tra lại bằng cách GET danh sách để xác nhận.
            try {
                const list = await merchantAPI.getMenuItems();
                const catId = String(Number(data.category));
                const priceStr = String(Number(data.price));
                const found = (list || []).find((it) => {
                    const itName = it?.name || '';
                    const itCat = String(it?.categoryId ?? it?.category_id ?? '');
                    const itPrice = String(it?.basePrice ?? it?.base_price ?? it?.price ?? '');
                    return itName.trim() === (data.name || '').trim()
                        && itCat === catId
                        && itPrice === priceStr;
                });
                if (found) {
                    // eslint-disable-next-line no-alert
                    alert('Tạo thành công (backend trả 500). Chuyển về danh sách.');
                    setImage(false);
                    setData({ name: '', description: '', category: '', price: '' });
                    navigate('/list');
                    return;
                }
            } catch {}
            // eslint-disable-next-line no-alert
            alert(err?.response?.data?.message || err?.message || 'Create failed');
        } finally {
            setSubmitting(false);
        }
    }
    return (
    <>

        <div className='icon-back'>{<><NavLink to="/list"><img src={assets.back} alt="Back" /></NavLink><p>Add New Product</p></>        
        }</div>
        <div className='add'>
        <form className="flex-col">
            <div className="add-img-upload flex-col">
                <p>Upload Image</p>
                <label htmlFor="image">
                    <img src={image?URL.createObjectURL(image):assets.upload_area} alt="" />
                </label>
                <input onChange ={(e)=> setImage(e.target.files[0])} type="file" id="image" hidden required />
            </div>
            <div className='add-product-name flex-col'>
                <p>Product Name</p>
                <input onChange = {onChangeHandler} value = {data.name} type="text" name='name' placeholder='Type Here'/>
            </div>
            <div className='add-product-description flex-col'>
                <p>Product Description</p>
                <textarea onChange = {onChangeHandler} value = {data.description} name='description' rows="6" placeholder='Write content here'></textarea>
            </div>
            <div className='add-category-price'>
                <div className='add-category flex-col'>
                    <p>Product Category</p>
                    <select name="category" value={data.category} onChange={onChangeHandler}>
                        <option value="" disabled>-- Chọn danh mục --</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name} (#{c.id})</option>
                        ))}
                    </select>
                </div>
                <div className='add-price flex-col'>
                    <p>Product Price</p>
                    <input onChange = {onChangeHandler} value = {data.price} type="number" min="1" step="1" name='price' placeholder='$20' />
                </div>
            </div>
            <button onClick={onSubmitHandler} type="submit" className='add-btn' disabled={submitting}>
                {submitting ? 'ADDING...' : 'ADD'}
            </button>
        </form>
        </div>

      
    </>
    )
}

export default Add
