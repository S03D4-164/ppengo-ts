import mongoose, { Schema, Document, Model, PassportLocalDocument, PassportLocalModel, PassportLocalSchema } from 'mongoose';
import passportLocalMongoose from 'passport-local-mongoose';

export interface IUser extends Document, PassportLocalDocument {
  username: string;
  hash: string;
  salt: string;
  active: boolean;
  group: string[];
  admin: boolean;
  apikey: string;
  _id: mongoose.Types.ObjectId;
}

interface UserModelType extends PassportLocalModel<IUser> {}

const UserSchema = new Schema<IUser, UserModelType>({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  hash: String,
  salt: String,
  active: Boolean,
  group: [String],
  admin: {
    type: Boolean,
    default: false,
  },
  apikey: String,
}) as PassportLocalSchema<IUser, UserModelType>;

UserSchema.plugin(passportLocalMongoose);

const UserModel: UserModelType = mongoose.model<IUser, UserModelType>('User', UserSchema);

export default UserModel;