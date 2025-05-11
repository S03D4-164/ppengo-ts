import mongoose, {
  Schema,
  InferSchemaType,
  model,
  PaginateModel,
} from "mongoose";
import paginate from "mongoose-paginate-v2";

// Define the schema
const gsbSchema = new Schema(
  {
    api: {
      type: String,
    },
    url: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    urlHash: {
      type: String,
    },
    result: {
      type: Object,
    },
  },
  { timestamps: true }
);

type gsbModelType = InferSchemaType<typeof gsbSchema>;

// Add plugins and indexes
gsbSchema.plugin(paginate);
gsbSchema.index({ createdAt: -1 });
gsbSchema.index({ urlHash: 1 });

const GSBModel = model<gsbModelType, PaginateModel<gsbModelType>>(
  "GSB",
  gsbSchema
);

// Export the model
export default GSBModel;
export { gsbModelType };
