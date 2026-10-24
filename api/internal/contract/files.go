package contract

type UploadInput struct {
	Tenant string `path:"tenant"`
	Body   struct {
		Purpose     string `json:"purpose" enum:"daily_photo,report,request,reimbursement,payroll_proof,product_image"`
		ContentType string `json:"contentType" enum:"image/webp,image/jpeg"`
		Size        int    `json:"size" minimum:"1" maximum:"1048576" doc:"Bytes, after the phone shrank it"`
		StoreID     string `json:"storeId,omitempty" format:"uuid" doc:"For a store's photos: daily_photo, report, request"`
	}
}

type UploadOutput struct {
	Body struct {
		UploadURL string `json:"uploadUrl" doc:"PUT the photo here, straight to Storage; it works for a few minutes"`
		Path      string `json:"path" doc:"Where it is kept, for the row that refers to it"`
		URL       string `json:"url" doc:"The address saved in the row (the old app's form); a private photo opens only through a signed address"`
	}
}
