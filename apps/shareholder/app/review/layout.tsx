import type {ReactNode} from "react";
import type {Metadata} from "next";
import "./review.css";

export const metadata:Metadata={
 title:"بازبینی پنل سهامداران | پلتفرم ملی",
 description:"بازبینی داخلی طراحی و پیمایش پنل سهامدار بدون دسترسی عملیاتی یا اطلاعات واقعی",
 robots:{index:false,follow:false,noarchive:true,nosnippet:true}
};
export default function ReviewLayout({children}:{children:ReactNode}){
 return children;
}
