import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, ScanCommand, DeleteCommand} from '@aws-sdk/lib-dynamodb';
import {S3Client, DeleteObjectsCommand} from "@aws-sdk/client-s3";
import {CognitoIdentityProviderClient, GetUserCommand} from "@aws-sdk/client-cognito-identity-provider";

const dynamoDBClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(dynamoDBClient);
const s3Client = new S3Client({});
const cognitoClient = new CognitoIdentityProviderClient({})
const tableName = 'Accommodation';

export const deleteAccommodationHandler = async (event) => {
    const accessToken = event.headers.Authorization;
    const eventBody = JSON.parse(event.body);
    const accommodationId = eventBody.id;
    try {
        const accommodationService = await new AccommodationService(accommodationId, accessToken);
        await accommodationService.delete();
        return {
            statusCode: 200,
            body: JSON.stringify({message: "Accommodation deleted successfully"})
        }
    } catch (error) {
        return {
            statusCode: 400,
            body: error.message
        }
    }
};

export class AccommodationService {
    _id;
    _hostId;
    _images;
    _repository;
    _cognitoRepository;

    constructor(
        id,
        accessToken,
        repository = new AccommodationRepository(),
        cognitoRepository = new CognitoRepository()
    ) {
        this._repository = repository;
        this._cognitoRepository = cognitoRepository;
        return (async () => {
            await this.setAccommodationInfo(id);
            await this.authorizeDeleteRequest(accessToken);
            return this;
        })();
    }

    get id() {
        return this._id;
    }

    get hostId() {
        return this._hostId;
    }

    get images() {
        return this._images;
    }

    get repository() {
        return this._repository;
    }

    get cognitoRepository() {
        return this._cognitoRepository;
    }

    async setAccommodationInfo(id) {
        try {
            const accommodation = await this.repository.getAccommodationById(id);
            if (!accommodation.Item) {
                throw "Accommodation not found."
            }
            this._id = accommodation.Item.ID;
            this._hostId = accommodation.Item.OwnerId;
            this._images = accommodation.Item.Images;
        } catch (error) {
            throw new Error("Accommodation not found.");
        }
    }

    async authorizeDeleteRequest(accessToken) {
        try {
            const user = await this.cognitoRepository.getUser(accessToken);
            if (user.Username != this.hostId) {
                throw "User is not the owner of this accommodation."
            }
        } catch (error) {
            throw new Error("You are not allowed to delete this accommodation.");
        }
    }

    async delete() {
        await this.repository.deleteImagesFromS3(this.images);
        await this.repository.deleteAccommodationFromDynamoDb(this.id);
    }

}

export class AccommodationRepository {

    async deleteImagesFromS3(images) {
        const deleteParams = {
            Bucket: 'accommodation',
            Delete: {
                Objects: images.map(image => ({Key: image}))
            }
        };
        return await s3Client.send(new DeleteObjectsCommand(deleteParams));
    }

    async getAccommodationById(id) {
        const params = {
            TableName: tableName,
            Key: {ID: id}
        };
        return await ddbDocClient.send(new ScanCommand(params));
    }

    async deleteAccommodationFromDynamoDb(id) {
        const params = {
            TableName: tableName,
            Key: {ID: id}
        };
        return await ddbDocClient.send(new DeleteCommand(params));
    }
}

export class CognitoRepository {

    async getUser(accessToken) {
        const params = new GetUserCommand({
            AccessToken: accessToken
        })
        return await cognitoClient.send(params);
    }
}